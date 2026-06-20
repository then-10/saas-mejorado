import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type Payment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * POST /api/admin/shop/orders/:id/payments/cash  Body: { amount }
 * Registra un pago en efectivo recibido en tienda.
 * - PURCHASE: el monto debe cubrir el total → orden PAID.
 * - LAYAWAY: cualquier monto es un abono; al cubrir el total → Layaway COMPLETED y orden PAID.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { amount } = await req.json()
    const amt = new Prisma.Decimal(Number(amount))
    if (!(Number(amount) > 0)) {
      return NextResponse.json({ error: 'amount debe ser mayor a 0' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { layaway: true, payments: true },
    })
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    if (!canAccessStore(session, order.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }
    if (['CANCELLED', 'EXPIRED', 'DELIVERED'].includes(order.status)) {
      return NextResponse.json({ error: `El pedido está en estado ${order.status}` }, { status: 422 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: 'CASH_IN_STORE',
          status: 'PAID',
          amount: amt,
          paidAt: new Date(),
        },
      })

      if (order.type === 'LAYAWAY' && order.layaway) {
        const paid = new Prisma.Decimal(order.layaway.paidAmount).add(amt)
        const completed = paid.gte(order.total)
        await tx.layaway.update({
          where: { id: order.layaway.id },
          data: { paidAmount: paid, status: completed ? 'COMPLETED' : 'ACTIVE' },
        })
        if (completed && order.status === 'PENDING_PAYMENT') {
          await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
        }
      } else {
        const alreadyPaid = (order.payments as Payment[])
          .filter((p: Payment) => p.status === 'PAID')
          .reduce((acc: Prisma.Decimal, p: Payment) => acc.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0))
        if (alreadyPaid.add(amt).gte(order.total) && order.status === 'PENDING_PAYMENT') {
          await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
        }
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, payments: true, layaway: true },
      })
    })

    await prisma.activityLog.create({
      data: {
        adminId: session.user.id ?? null,
        action: 'CASH_PAYMENT_REGISTERED',
        entityType: 'Order',
        entityId: order.id,
        details: `Efectivo: $${Number(amount).toFixed(2)} ${order.type === 'LAYAWAY' ? '(abono de apartado)' : ''}`,
      },
    })

    return NextResponse.json({ order: serializeOrder(updated) })
  } catch {
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
  }
}
