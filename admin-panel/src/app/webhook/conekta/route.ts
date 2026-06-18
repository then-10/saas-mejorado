import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPaidPaymentByExternalId } from "@/lib/shop/payments/applyPaidPayment";
import { ConektaAdapter } from "@/lib/shop/payments/ConektaAdapter";

/**
 * POST /webhook/conekta
 * Webhook de confirmación de Conekta.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);

  const secretForValidation = process.env.CONEKTA_WEBHOOK_SECRET;
  if (!secretForValidation) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const adapter = new ConektaAdapter("");
  const isValid = adapter.verifyWebhookSignature({
    headers: Object.fromEntries(req.headers),
    body: rawBody,
  });

  if (!isValid) {
    console.warn("Firma de Conekta inválida");
    return NextResponse.json({ ok: true });
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
