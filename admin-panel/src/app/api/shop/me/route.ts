import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStore, unauthorizedTenant } from "@/lib/shop/tenant";
import { verifyCustomer, unauthorizedCustomer } from "@/lib/shop/customer-auth";

/**
 * GET /api/shop/me
 * Perfil del cliente autenticado (para ProfileScreen de la app).
 */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req);
  if (!store) return unauthorizedTenant();
  const token = await verifyCustomer(req, store.id);
  if (!token) return unauthorizedCustomer();

  const customer = await prisma.customer.findFirst({
    where: { id: token.customerId, storeId: store.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true },
  });
  if (!customer) return unauthorizedCustomer();

  return NextResponse.json({ customer });
}
