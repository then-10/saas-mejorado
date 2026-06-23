import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * POST /api/admin/shop/customers/:id/payments  Body: { amount }
 * Abono "a cuenta": dinero entregado por el cliente que NO está ligado a un
 * pedido específico. Reparte el monto, en efectivo, entre los pedidos LAYAWAY
 * activos del cliente (los mas antiguos primero) -- el mismo criterio que
 * usaba el wallet offline de la app Android (registerAbonoToCuenta) -- y
 * registra un Payment por cada pedido afectado.
 *
 * Si el monto excede la deuda total, el remanente no se aplica a ningun
 * pedido (no existe todavia concepto de saldo a favor del cliente) y se
 * informa en la respuesta via "unapplied".
 *
 * No requiere migracion de schema: reutiliza Payment.orderId (NOT NULL) y
 * Layaway, igual que /orders/:id/payments/cash.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let amount: number
  try {
    const body = await req.json()
    amount = Number(body.amount)
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: 'amount es requerido' }, { status: 400 })
  }
  if (!(amount > 0)) {
    return NextResponse.json({ error: 'amount debe ser mayor a 0' }, { status: 422 })
  }

  const customer = await prisma.customer.findUnique({ where: { id: params.id } })
  if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (!canAccessStore(session, customer.storeId)) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activeOrders = await tx.order.findMany({
        where: {
          customerId: customer.id,
          type: 'LAYAWAY',
          layaway: { status: 'ACTIVE' },
        },
        include: { layaway: true },
        orderBy: { createdAt: 'asc' },
      })

      let remaining = new Prisma.Decimal(amount)
      const paymentsCreated: { orderId: string; amount: number }[] = []

      for (const order of activeOrders) {
        if (remaining.lte(0)) break
        if (!order.layaway) continue

        const saldo = new Prisma.Decimal(order.total).sub(new Prisma.Decimal(order.layaway.paidAmount))
        if (saldo.lte(0)) continue

        const applied = Prisma.Decimal.min(remaining, saldo)

        await tx.payment.create({
          data: {
            orderId: order.id,
            method: 'CASH_IN_STORE',
            status: 'PAID',
            amount: applied,
            paidAt: new Date(),
          },
        })

        const newPaid = new Prisma.Decimal(order.layaway.paidAmount).add(applied)
        const completed = newPaid.gte(order.total)
        await tx.layaway.update({
          where: { id: order.layaway.id },
          data: { paidAmount: newPaid, status: completed ? 'COMPLETED' : 'ACTIVE' },
        })
        if (completed && order.status === 'PENDING_PAYMENT') {
          await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
        }

        paymentsCreated.push({ orderId: order.id, amount: applied.toNumber() })
        remaining = remaining.sub(applied)
      }

      return { paymentsCreated, unapplied: remaining.toNumber() }
    })

    await prisma.activityLog.create({
      data: {
        adminId: session.user.id ?? null,
        action: 'ACCOUNT_PAYMENT_REGISTERED',
        entityType: 'Customer',
        entityId: customer.id,
        details: `Abono a cuenta: $${amount.toFixed(2)} repartido en ${result.paymentsCreated.length} pedido(s)` +
          (result.unapplied > 0 ? `; $${result.unapplied.toFixed(2)} sin aplicar (sin deuda pendiente)` : ''),
      },
    })

    return NextResponse.json(
      {
        payment: {
          customerId: customer.id,
          amount,
          appliedTo: result.paymentsCreated,
          unapplied: result.unapplied,
        },
        customer: { id: customer.id, name: customer.name },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Error al registrar el abono' }, { status: 500 })
  }
}
