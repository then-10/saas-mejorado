import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyOwnerOfSale } from "@/lib/shop/notifications/notifyOwnerOfSale";

/**
 * Aplica un pago confirmado por el proveedor (webhook o polling) de forma
 * IDEMPOTENTE: el "claim" atómico (updateMany WHERE status != PAID) garantiza
 * que aunque el webhook y el polling lleguen a la vez, el efecto se aplica una vez.
 *
 * Consciente de apartados:
 * - PURCHASE  → orden PAID.
 * - LAYAWAY   → incrementa layaway.paidAmount; si cubre order.total →
 *               Layaway COMPLETED + orden PAID; si no, sigue PENDING_PAYMENT.
 */
export async function applyPaidPayment(paymentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Claim atómico: solo un proceso gana
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return; // ya aplicado por otro proceso

    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: { layaway: true, store: { select: { name: true } } },
    });
    if (!order) return;

    let fullyPaid = false;

    if (order.type === "LAYAWAY" && order.layaway) {
      const paid = new Prisma.Decimal(order.layaway.paidAmount).add(
        new Prisma.Decimal(payment.amount)
      );
      const completed = paid.gte(new Prisma.Decimal(order.total));
      await tx.layaway.update({
        where: { id: order.layaway.id },
        data: { paidAmount: paid, status: completed ? "COMPLETED" : "ACTIVE" },
      });
      if (completed) {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        fullyPaid = true;
      }
    } else {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
      fullyPaid = true;
    }

    // Notificación fuera de la ruta crítica (no rompe la transacción si falla)
    const storeName = order.store.name;
    const total = Number(payment.amount);
    const method = payment.method;
    const orderId = order.id;
    queueMicrotask(() => {
      notifyOwnerOfSale({
        storeName,
        orderId,
        total,
        method: fullyPaid ? method : `${method} (abono)`,
      }).catch(() => {});
    });
  });
}

/**
 * Resuelve el paymentId interno a partir del externalId del proveedor
 * y aplica el pago. Para webhooks.
 */
export async function applyPaidPaymentByExternalId(externalId: string): Promise<void> {
  const payment = await prisma.payment.findFirst({ where: { externalId } });
  if (!payment) return;
  await applyPaidPayment(payment.id);
}
