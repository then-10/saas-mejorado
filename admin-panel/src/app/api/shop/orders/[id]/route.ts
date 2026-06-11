import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { verifyCustomer, unauthorizedCustomer } from '@/lib/shop/customer-auth'
import { serializeOrder } from '@/lib/shop/serialize'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const customer = await verifyCustomer(req, store.id)
  if (!customer) return unauthorizedCustomer()

  const order = await prisma.order.findFirst({
    where: { id: params.id, storeId: store.id, customerId: customer.customerId },
    include: { items: true, payments: true, layaway: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  return NextResponse.json({ order: serializeOrder(order) })
}
