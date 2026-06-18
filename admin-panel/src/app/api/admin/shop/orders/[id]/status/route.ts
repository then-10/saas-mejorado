import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'

/** Transiciones de estado permitidas (el dueño no puede saltarse el pago). */
const TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED', 'EXPIRED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'SHIPPED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
}

/** PATCH /api/admin/shop/orders/:id/status  Body: { status } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { status } = await req.json()
    const order = await prisma.order.findUnique({ where: { id: params.id } })
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const allowed = TRANSITIONS[order.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Transición inválida: ${order.status} → ${status}. Permitidas: ${allowed.join(', ') || 'ninguna'}` },
        { status: 422 }
      )
    }

    // Cancelación: devolver stock y cerrar apartado si existe
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'CANCELLED' || status === 'EXPIRED') {
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } })
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })
        }
        await tx.layaway.updateMany({
          where: { orderId: order.id, status: 'ACTIVE' },
          data: { status: status === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED' },
        })
      }
      return tx.order.update({
        where: { id: order.id },
        data: { status },
        include: { items: true, payments: true, layaway: true },
      })
    })

    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'Order',
        entityId: order.id,
        details: `${order.status} → ${status}`,
      },
    })

    return NextResponse.json({ order: serializeOrder(updated) })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el estado' }, { status: 500 })
  }
}
