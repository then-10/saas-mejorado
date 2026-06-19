import type { Store, Order } from "@prisma/client";
import type {
  CreatePaymentIntentResult,
  VerifyPaymentResult,
  PaymentProvider,
} from "./PaymentProvider";
import { createHmac } from "crypto";

/**
 * Adaptador para Conekta (https://api.conekta.com/).
 * Docs: https://developers.conekta.com/
 */
export class ConektaAdapter implements PaymentProvider {
  private privateKey: string;

  constructor(privateKey: string) {
    this.privateKey = privateKey;
  }

  private async request(
    method: "POST" | "GET",
    path: string,
    body?: any
  ): Promise<any> {
    const auth = Buffer.from(this.privateKey + ":").toString("base64");
    const response = await fetch(`https://api.conekta.com${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.conekta-v2.1.0+json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Conekta error: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  async createCardCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    const order_obj = await this.request("POST", "/orders", {
      line_items: [
        {
          name: `Pedido ${order.id}`,
          unit_price: Math.round(amount * 100), // centavos
          quantity: 1,
        },
      ],
      customer_info: {
        email: order.store.name,
      },
      charges: [
        {
          payment_method: {
            type: "card",
            // El cliente proporciona el token desde el navegador (Conekta.js)
            // Aquí solo creamos la orden; el token se envía desde el frontend.
          },
          amount: Math.round(amount * 100),
        },
      ],
      metadata: {
        order_id: order.id,
      },
    });

    return {
      checkoutUrl: order_obj.checkout?.url,
      paymentId: order_obj.id,
      externalId: order_obj.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async createSpeiCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    const order_obj = await this.request("POST", "/orders", {
      line_items: [
        {
          name: `Pedido ${order.id} (SPEI)`,
          unit_price: Math.round(amount * 100),
          quantity: 1,
        },
      ],
      charges: [
        {
          payment_method: {
            type: "spei",
          },
          amount: Math.round(amount * 100),
        },
      ],
      metadata: {
        order_id: order.id,
      },
    });

    const charge = order_obj.charges?.[0];
    const speiData = charge?.payment_method?.details;

    return {
      reference: speiData?.account_number,
      externalId: order_obj.id,
      expiresAt: new Date(speiData?.expires_at || Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async createCashCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult> {
    const order_obj = await this.request("POST", "/orders", {
      line_items: [
        {
          name: `Pedido ${order.id} (OXXO)`,
          unit_price: Math.round(amount * 100),
          quantity: 1,
        },
      ],
      charges: [
        {
          payment_method: {
            type: "oxxo",
          },
          amount: Math.round(amount * 100),
        },
      ],
      metadata: {
        order_id: order.id,
      },
    });

    const charge = order_obj.charges?.[0];
    const oxxoData = charge?.payment_method?.details;

    return {
      reference: oxxoData?.reference,
      barcodeUrl: oxxoData?.barcode_url,
      externalId: order_obj.id,
      expiresAt: new Date(oxxoData?.expires_at || Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async verifyPayment(externalId: string): Promise<VerifyPaymentResult> {
    const order_obj = await this.request("GET", `/orders/${externalId}`);
    const charge = order_obj.charges?.[0];

    if (!charge) {
      return { status: "pending", amount: 0 };
    }

    const statusMap: Record<string, VerifyPaymentResult["status"]> = {
      paid: "paid",
      pending: "pending",
      failed: "failed",
      expired: "expired",
    };

    return {
      status: statusMap[charge.status] || "pending",
      amount: charge.amount / 100,
      paidAt: charge.status === "paid" ? new Date(charge.paid_at) : undefined,
    };
  }

  verifyWebhookSignature(req: {
    headers: Record<string, any>;
    body: string;
  }): boolean {
    const signature = req.headers["conekta-signature"] || req.headers["x-conekta-webhook-signature"];
    if (!signature) return false;

    const secret = process.env.CONEKTA_WEBHOOK_SECRET;
    if (!secret) return false;

    const computed = createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    return computed === signature;
  }

  normalizeWebhookEvent(body: any): { externalId: string; status: "paid" | "failed" | "expired"; amount: number } | null {
    if (body.type === "order.paid") {
      return {
        externalId: body.data.id,
        status: "paid",
        amount: body.data.amount / 100,
      };
    }
    if (body.type === "charge.paid") {
      return {
        externalId: body.data.order_id,
        status: "paid",
        amount: body.data.amount / 100,
      };
    }
    return null;
  }
}
