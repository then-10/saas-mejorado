import { MercadoPagoAdapter } from "./MercadoPagoAdapter";
import { ConektaAdapter } from "./ConektaAdapter";
import type { Store } from "@prisma/client";
import type { PaymentProvider } from "./PaymentProvider";
import { decryptField } from "./encryption";

/**
 * Obtiene el adaptador de pago configurado para la tienda.
 * Las llaves se descifran desde la BD solo cuando se necesitan.
 */
export function getPaymentProvider(store: Store): PaymentProvider {
  if (store.paymentProvider === "CONEKTA") {
    if (!store.conektaKeyEnc) {
      throw new Error("Conekta no está configurado para esta tienda");
    }
    const privateKey = decryptField(store.conektaKeyEnc);
    return new ConektaAdapter(privateKey);
  } else {
    // MERCADO_PAGO
    if (!store.mpAccessTokenEnc) {
      throw new Error("Mercado Pago no está configurado para esta tienda");
    }
    const accessToken = decryptField(store.mpAccessTokenEnc);
    return new MercadoPagoAdapter(accessToken);
  }
}
