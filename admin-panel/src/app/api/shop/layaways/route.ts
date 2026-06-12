import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";
import { verifyCustomer, unauthorizedCustomer } from "@/lib/shop/customer-auth";
import { serializeLayaway } from "@/lib/shop/serialize";

/**
 * GET /api/shop/layaways
 * Apartados del cliente autenticado (con resumen del pedido y pagos).
 * Los abonos en efectivo los registra el dueño (POST /api/admin/shop/orders/:id/payments/cash);
 * los abonos del cliente vía Mercado Pago/Conekta llegan en una fase posterior.
 */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();
  const customer = await verifyCustomer(req, store.id);
  if (!customer) return unauthorizedCustomer();

  try {
    const layaways = await prisma.layaway.findMany({
      where: { order: { customerId: customer.customerId, storeId: store.id } },
      include: {
        order: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
            items: { select: { productName: true, quantity: true } },
            payments: {
              select: { id: true, amount: true, method: true, status: true, paidAt: true },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ layaways: layaways.map(serializeLayaway) });
  } catch {
    return NextResponse.json({ error: "Error al consultar apartados" }, { status: 500 });
  }
}
