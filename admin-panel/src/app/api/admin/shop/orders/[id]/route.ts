import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/** GET /api/admin/shop/orders/:id — detalle de un pedido. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, payments: true, layaway: true, customer: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (!canAccessStore(session, order.storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  return NextResponse.json({ order: serializeOrder(order) })
}
