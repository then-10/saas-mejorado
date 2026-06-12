/**
 * Abstracción de proveedores de pago (Mercado Pago, Conekta).
 * La app Android nunca toca las llaves; todo se genera en el servidor.
 */

import type { Store, Order } from "@prisma/client";

export interface CreatePaymentIntentResult {
  checkoutUrl?: string; // Mercado Pago
  paymentId?: string; // Conekta
  redirectUrl?: string;
  reference?: string; // SPEI CLABE
  barcodeUrl?: string; // OXXO
  expiresAt: Date;
  externalId: string;
}

export interface VerifyPaymentResult {
  status: "paid" | "pending" | "failed" | "expired";
  amount: number;
  paidAt?: Date;
  reference?: string;
}

export interface PaymentProvider {
  /**
   * Crea un intento de pago con tarjeta (genera URL de checkout).
   * La app abre esta URL en un Custom Tab y hace polling a GET /payments/:id.
   */
  createCardCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult>;

  /**
   * Crea una orden SPEI: devuelve CLABE, banco y vencimiento.
   * El cliente transfiere; el webhook confirma.
   */
  createSpeiCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult>;

  /**
   * Crea una orden de efectivo (OXXO o código de barras).
   */
  createCashCharge(
    order: Order & { store: Store },
    amount: number
  ): Promise<CreatePaymentIntentResult>;

  /**
   * Verifica una orden existente (usado para polling de confirmación).
   */
  verifyPayment(externalId: string): Promise<VerifyPaymentResult>;

  /**
   * Valida la firma del webhook (crítico para seguridad).
   */
  verifyWebhookSignature(
    req: { headers: Record<string, any>; body: string }
  ): boolean;

  /**
   * Normaliza el evento del webhook a un formato estándar.
   */
  normalizeWebhookEvent(body: any): {
    externalId: string;
    status: "paid" | "failed" | "expired";
    amount: number;
  } | null;
}
