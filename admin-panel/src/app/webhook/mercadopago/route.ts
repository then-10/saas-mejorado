import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyOwnerOfSale } from "@/lib/shop/notifications/notifyOwnerOfSale";
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

  // Idempotencia: si ya procesamos este evento, no hacer nada
  const payment = await prisma.payment.findUnique({
    where: { externalId: event.externalId },
  });

  if (payment && payment.status === "PAID") {
    return NextResponse.json({ ok: true }); // Ya procesado
  }

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: event.status === "paid" ? "PAID" : "FAILED",
        paidAt: event.status === "paid" ? new Date() : null,
      },
    });

    if (event.status === "paid") {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: "PAID" },
      });

      // Notificar al dueño (no bloquea ni rompe el webhook si falla)
      const order = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { store: { select: { name: true } } },
      });
      if (order) {
        notifyOwnerOfSale({
          storeName: order.store.name,
          orderId: order.id,
          total: Number(order.total),
          method: payment.method,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
