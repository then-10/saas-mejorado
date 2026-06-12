import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyOwnerOfSale } from "@/lib/shop/notifications/notifyOwnerOfSale";
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

  const payment = await prisma.payment.findUnique({
    where: { externalId: event.externalId },
  });

  if (payment && payment.status === "PAID") {
    return NextResponse.json({ ok: true });
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
