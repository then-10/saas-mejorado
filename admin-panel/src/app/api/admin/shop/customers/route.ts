import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * GET /api/admin/shop/customers?storeId=...
 * Lista de clientes de la tienda con resumen de compras y saldo deudor
 * (apartados ACTIVE: total del pedido menos lo abonado).
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(req.url).searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })
  if (!canAccessStore(session, storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const customers = await prisma.customer.findMany({
    where: { storeId },
    include: {
      orders: {
        select: { total: true, layaway: { select: { paidAmount: true, status: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    customers: customers.map((c) => {
      const purchaseCount = c.orders.length
      const totalSpent = c.orders.reduce((acc, o) => acc.add(new Prisma.Decimal(o.total)), new Prisma.Decimal(0))
      const debt = c.orders.reduce((acc, o) => {
        if (o.layaway?.status === 'ACTIVE') {
          const remaining = new Prisma.Decimal(o.total).sub(new Prisma.Decimal(o.layaway.paidAmount))
          return remaining.gt(0) ? acc.add(remaining) : acc
        }
        return acc
      }, new Prisma.Decimal(0))

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        purchaseCount,
        totalSpent: totalSpent.toNumber(),
        debt: debt.toNumber(),
      }
    }),
  })
}
