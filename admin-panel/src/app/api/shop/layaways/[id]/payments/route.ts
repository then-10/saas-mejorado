import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";
import { verifyCustomer, unauthorizedCustomer } from "@/lib/shop/customer-auth";
import { getPaymentProvider } from "@/lib/shop/payments/getPaymentProvider";

/**
 * POST /api/shop/layaways/:id/payments
 * Body: { method: "CARD" | "SPEI" | "CASH_OXXO", amount: number }
 *
 * Abono del CLIENTE a su apartado vía proveedor (MP/Conekta).
 * - Cualquier monto > 0 y <= restante (order.total - paidAmount).
 * - El pago queda PENDING; el webhook (o el polling) lo confirma con
 *   applyPaidPayment, que incrementa paidAmount y completa al cubrir el total.
 * - Abonos en EFECTIVO los registra el dueño con el endpoint admin existente.
 * - El estado del abono se consulta con el polling ya existente:
 *   GET /api/shop/orders/:orderId/payments?paymentId=...
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();
  const customer = await verifyCustomer(req, store.id);
  if (!customer) return unauthorizedCustomer();

  try {
    const { method, amount } = await req.json();

    if (!["CARD", "SPEI", "CASH_OXXO"].includes(method)) {
      return NextResponse.json({ error: "Método de pago no válido" }, { status: 400 });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const layaway = await prisma.layaway.findFirst({
      where: {
        id: params.id,
        order: { storeId: store.id, customerId: customer.customerId },
      },
      include: { order: true },
    });
    if (!layaway) {
      return NextResponse.json({ error: "Apartado no encontrado" }, { status: 404 });
    }
    if (layaway.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `El apartado está ${layaway.status}, no admite abonos` },
        { status: 422 }
      );
    }
    if (new Date() > layaway.dueDate) {
      return NextResponse.json(
        { error: "El apartado está vencido" },
        { status: 422 }
      );
    }

    const remaining = new Prisma.Decimal(layaway.order.total).sub(
      new Prisma.Decimal(layaway.paidAmount)
    );
    if (new Prisma.Decimal(amt).gt(remaining)) {
      return NextResponse.json(
        { error: `El abono excede lo restante ($${remaining.toFixed(2)})` },
        { status: 422 }
      );
    }

    const provider = getPaymentProvider(store);
    let result;
    try {
      if (method === "CARD") {
        result = await provider.createCardCharge({ ...layaway.order, store }, amt);
      } else if (method === "SPEI") {
        result = await provider.createSpeiCharge({ ...layaway.order, store }, amt);
      } else {
        result = await provider.createCashCharge({ ...layaway.order, store }, amt);
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Error con el proveedor: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: layaway.orderId,
        provider: store.paymentProvider,
        method: method as any,
        status: "PENDING",
        amount: new Prisma.Decimal(amt),
        externalId: result.externalId,
        reference: result.reference,
        expiresAt: result.expiresAt,
      },
    });

    return NextResponse.json(
      {
        payment: {
          id: payment.id,
          orderId: layaway.orderId,
          method,
          amount: amt,
          checkoutUrl: result.checkoutUrl,
          reference: result.reference,
          barcodeUrl: result.barcodeUrl,
          expiresAt: result.expiresAt?.toISOString(),
        },
        remaining: Number(remaining.sub(new Prisma.Decimal(amt))),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Error al crear el abono" }, { status: 500 });
  }
}
