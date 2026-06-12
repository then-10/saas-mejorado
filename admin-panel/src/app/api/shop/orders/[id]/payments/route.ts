import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";
import { verifyCustomer, unauthorizedCustomer } from "@/lib/shop/customer-auth";
import { getPaymentProvider } from "@/lib/shop/payments/getPaymentProvider";
import { applyPaidPayment } from "@/lib/shop/payments/applyPaidPayment";

/**
 * POST /api/shop/orders/:id/payments
 * Body: { method: "CARD" | "SPEI" | "CASH_OXXO" | "CASH_IN_STORE" }
 * Crea un intento de pago y devuelve los detalles según el método.
 * La app debe redirigir a checkoutUrl (Card) o mostrar CLABE/código de barras.
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
    const { method } = await req.json();
    if (!["CARD", "SPEI", "CASH_OXXO", "CASH_IN_STORE"].includes(method)) {
      return NextResponse.json({ error: "Método de pago no válido" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: params.id, storeId: store.id, customerId: customer.customerId },
      include: { items: true, payments: true, layaway: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: `El pedido ya fue pagado o está en estado ${order.status}` },
        { status: 422 }
      );
    }

    // LAYAWAY: este endpoint cobra el ANTICIPO (primer pago). Los abonos
    // posteriores van por POST /api/shop/layaways/:id/payments.
    if (order.type === "LAYAWAY" && order.layaway && Number(order.layaway.paidAmount) > 0) {
      return NextResponse.json(
        { error: "El anticipo ya fue pagado; usa el endpoint de abonos del apartado" },
        { status: 422 }
      );
    }
    const chargeAmount =
      order.type === "LAYAWAY" && order.layaway
        ? Number(order.layaway.depositAmount)
        : Number(order.total);

    // Pago en tienda: sin proveedor, solo registrar
    if (method === "CASH_IN_STORE") {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          method: "CASH_IN_STORE",
          status: "PENDING",
          amount: new Prisma.Decimal(chargeAmount),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        },
      });
      return NextResponse.json({
        payment: {
          id: payment.id,
          method: "CASH_IN_STORE",
          reference: `Pedir en tienda: ${payment.id.slice(0, 8)}`,
          expiresAt: payment.expiresAt?.toISOString(),
        },
      });
    }

    // Proveedor de pago (MP o Conekta)
    const provider = getPaymentProvider(store);
    let result;

    try {
      if (method === "CARD") {
        result = await provider.createCardCharge(
          { ...order, store },
          chargeAmount
        );
      } else if (method === "SPEI") {
        result = await provider.createSpeiCharge(
          { ...order, store },
          chargeAmount
        );
      } else {
        // CASH_OXXO
        result = await provider.createCashCharge(
          { ...order, store },
          chargeAmount
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Error con el proveedor: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    // Guardar intento de pago en BD
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: store.paymentProvider,
        method: method as any,
        status: "PENDING",
        amount: new Prisma.Decimal(chargeAmount),
        externalId: result.externalId,
        reference: result.reference,
        expiresAt: result.expiresAt,
      },
    });

    return NextResponse.json(
      {
        payment: {
          id: payment.id,
          method,
          checkoutUrl: result.checkoutUrl,
          reference: result.reference, // CLABE o código OXXO
          barcodeUrl: result.barcodeUrl,
          expiresAt: result.expiresAt?.toISOString(),
          externalId: result.externalId,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: "Error al crear el pago" }, { status: 500 });
  }
}

/**
 * GET /api/shop/orders/:id/payments/:paymentId
 * Verifica el estado de un pago (polling desde la app).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();

  const customer = await verifyCustomer(req, store.id);
  if (!customer) return unauthorizedCustomer();

  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("paymentId");
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId es requerido" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, order: { id: params.id, customerId: customer.customerId } },
    });
    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    // Pago en tienda: sin verificación remota
    if (payment.method === "CASH_IN_STORE") {
      return NextResponse.json({
        payment: {
          id: payment.id,
          status: payment.status,
          method: "CASH_IN_STORE",
        },
      });
    }

    // Verificar con el proveedor
    if (!payment.externalId) {
      return NextResponse.json(
        { error: "Pago no completado aún" },
        { status: 404 }
      );
    }

    const provider = getPaymentProvider(store);
    const result = await provider.verifyPayment(payment.externalId);

    // Aplicar el resultado con la lógica compartida (idempotente y
    // consciente de apartados: abonos incrementan paidAmount).
    if (result.status === "paid") {
      await applyPaidPayment(payment.id);
    } else if (result.status === "failed" && payment.status === "PENDING") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
    }

    return NextResponse.json({
      payment: {
        id: payment.id,
        status: result.status,
        paidAt: result.paidAt?.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Error al verificar el pago" }, { status: 500 });
  }
}
