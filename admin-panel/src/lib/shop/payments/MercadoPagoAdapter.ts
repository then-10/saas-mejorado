import type { Store, Order } from "@prisma/client";
import type {
  CreatePaymentIntentResult,
  VerifyPaymentResult,
  PaymentProvider,
} from "./PaymentProvider";
import { createHmac } from "crypto";

/**
 * Adaptador para Mercado Pago (v2 API).
 * Docs: https://developers.mercadopago.com/es/reference
 */
export class MercadoPagoAdapter implements PaymentProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createCardCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    const preference = {
      items: [
        {
          id: order.id,
          title: `Pedido ${order.id}`,
          quantity: 1,
          unit_price: amount,
        },
      ],
      payer: {
        email: order.store.name,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/api/shop/payments/${order.id}/callback?status=success`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/api/shop/payments/${order.id}/callback?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL}/api/shop/payments/${order.id}/callback?status=pending`,
      },
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/webhook/mercadopago`,
      external_reference: order.id,
      expires: false,
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      throw new Error(`MP error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    return {
      checkoutUrl: data.init_point,
      externalId: data.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    };
  }

  async createSpeiCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    // Mercado Pago SPEI: también usa preferencias, pero los datos se extraen de la respuesta
    // en otro formato. Por ahora, reutilizamos Card pero el frontend los interpreta como SPEI.
    // Idealmente separaría en dos métodos de pago distintos.
    return this.createCardCharge(order, amount);
  }

  async createCashCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    // Similar: mismo flujo de preferencias.
    return this.createCardCharge(order, amount);
  }

  async verifyPayment(externalId: string): Promise<VerifyPaymentResult> {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${externalId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`MP verify error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (!data.results || data.results.length === 0) {
      return { status: "pending", amount: 0 };
    }

    const payment = data.results[0];
    const statusMap: Record<string, VerifyPaymentResult["status"]> = {
      approved: "paid",
      pending: "pending",
      authorized: "pending",
      in_process: "pending",
      rejected: "failed",
      cancelled: "failed",
      refunded: "failed",
      expired: "expired",
    };

    return {
      status: statusMap[payment.status] || "pending",
      amount: payment.transaction_amount,
      paidAt: payment.status === "approved" ? new Date(payment.date_approved) : undefined,
    };
  }

  verifyWebhookSignature(req: {
    headers: Record<string, any>;
    body: string;
  }): boolean {
    // Mercado Pago v2 usa X-Signature
    const signature = req.headers["x-signature"] || req.headers["x-mp-signature"];
    if (!signature) return false;

    const parts = signature.split(",").map((p) => p.trim());
    const ts = parts
      .find((p) => p.startsWith("ts="))
      ?.replace("ts=", "");
    const hash = parts
      .find((p) => p.startsWith("v1="))
      ?.replace("v1=", "");

    if (!ts || !hash) return false;

    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) return false;

    const message = `${ts}.${req.body}`;
    const computed = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    return computed === hash;
  }

  normalizeWebhookEvent(body: any) {
    if (body.type === "payment") {
      return {
        externalId: body.data.id.toString(),
        status: body.data.status === "approved" ? "paid" : "failed",
        amount: body.data.transaction_amount,
      };
    }
    return null;
  }
}
