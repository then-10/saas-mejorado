import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * GET /api/admin/shop/customers/:id — perfil del cliente con historial de
 * compras (cada pedido serializado igual que /api/admin/shop/orders) y
 * saldo deudor por apartados activos.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        include: { items: true, payments: true, layaway: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (!canAccessStore(session, customer.storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const totalSpent = customer.orders.reduce((acc, o) => acc.add(new Prisma.Decimal(o.total)), new Prisma.Decimal(0))
  const debt = customer.orders.reduce((acc, o) => {
    if (o.layaway?.status === 'ACTIVE') {
      const remaining = new Prisma.Decimal(o.total).sub(new Prisma.Decimal(o.layaway.paidAmount))
      return remaining.gt(0) ? acc.add(remaining) : acc
    }
    return acc
  }, new Prisma.Decimal(0))

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      purchaseCount: customer.orders.length,
      totalSpent: totalSpent.toNumber(),
      debt: debt.toNumber(),
      orders: customer.orders.map(serializeOrder),
    },
  })
}

/**
 * PUT /api/admin/shop/customers/:id  Body: { name?, phone? }
 * Edición manual de los datos de contacto del cliente.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    if (!canAccessStore(session, existing.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }

    const { name, phone } = await req.json()
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'name no puede estar vacío' }, { status: 400 })
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    })

    return NextResponse.json({ id: updated.id, name: updated.name, phone: updated.phone })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el cliente' }, { status: 500 })
  }
}
