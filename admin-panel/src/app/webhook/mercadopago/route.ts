import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPaidPaymentByExternalId } from "@/lib/shop/payments/applyPaidPayment";
import { MercadoPagoAdapter } from "@/lib/shop/payments/MercadoPagoAdapter";

/**
 * POST /webhook/mercadopago
 * Webhook de confirmación de Mercado Pago.
 * Solo procesa si la firma es válida.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);

  // Verificar firma con UNA instancia (la del tenant no la tenemos sin context)
  // En producción, tendrías que buscar la store por external_reference e iterar proveedores.
  const secretForValidation = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secretForValidation) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const adapter = new MercadoPagoAdapter("");
  const isValid = adapter.verifyWebhookSignature({
    headers: Object.fromEntries(req.headers),
    body: rawBody,
  });

  if (!isValid) {
    console.warn("Firma de Mercado Pago inválida");
    return NextResponse.json({ ok: true }); // Mercado Pago requiere 200 aunque sea inválido
  }

  const event = adapter.normalizeWebhookEvent(body);
  if (!event) {
    return NextResponse.json({ ok: true });
  }

  if (event.status === "paid") {
    // Idempotente y consciente de apartados (abonos) — lógica compartida
    await applyPaidPaymentByExternalId(event.externalId);
  } else {
    await prisma.payment.updateMany({
      where: { externalId: event.externalId, status: "PENDING" },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ ok: true });
}
