import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { verifyEmployee, unauthorizedEmployee } from '@/lib/shop/employee-auth'
import { serializeOrder } from '@/lib/shop/serialize'

interface OrderItemInput {
  productId: string
  quantity: number
  size?: string
}

const WALK_IN_EMAIL = 'mostrador@pos.local'

/**
 * POST /api/shop/pos/orders — venta de mostrador desde el POS web (empleado autenticado).
 * Body: { items: [{productId, quantity, size?}] }
 * A diferencia de /api/shop/orders (app del cliente final), esta venta se registra como
 * PAID de inmediato (efectivo en mostrador) y no requiere cuenta de Customer real.
 */
export async function POST(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const employee = await verifyEmployee(req, store.id)
  if (!employee) return unauthorizedEmployee()

  let body: { items?: OrderItemInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const items = (body.items ?? []).filter(
    (i) => i?.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 50
  )
  if (items.length === 0 || items.length > 30) {
    return NextResponse.json({ error: 'La venta debe tener entre 1 y 30 artículos válidos' }, { status: 400 })
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const walkInCustomer = await tx.customer.upsert({
        where: { storeId_email: { storeId: store.id, email: WALK_IN_EMAIL } },
        update: {},
        create: {
          storeId: store.id,
          name: 'Venta de mostrador',
          email: WALK_IN_EMAIL,
          passwordHash: await bcrypt.hash(WALK_IN_EMAIL + store.id, 10),
        },
      })

      const ids = items.map((i) => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: ids }, storeId: store.id, isActive: true },
      })
      const byId = new Map<string, Product>(products.map((p: Product) => [p.id, p]))

      for (const item of items) {
        const p = byId.get(item.productId)
        if (!p) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`)
        const updated = await tx.product.updateMany({
          where: { id: p.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (updated.count === 0) throw new Error(`OUT_OF_STOCK:${p.name}`)
      }

      const subtotal = items.reduce((acc: Prisma.Decimal, item) => {
        const p = byId.get(item.productId)!
        return acc.add(new Prisma.Decimal(p.price).mul(item.quantity))
      }, new Prisma.Decimal(0))

      const created = await tx.order.create({
        data: {
          storeId: store.id,
          customerId: walkInCustomer.id,
          type: 'PURCHASE',
          status: 'PAID',
          subtotal,
          total: subtotal,
          items: {
            create: items.map((item) => {
              const p = byId.get(item.productId)!
              return {
                productId: p.id,
                name: p.name,
                unitPrice: p.price,
                quantity: item.quantity,
                size: item.size ?? '',
              }
            }),
          },
          payments: {
            create: {
              method: 'CASH_IN_STORE',
              status: 'PAID',
              amount: subtotal,
              paidAt: new Date(),
            },
          },
        },
      })

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true, payments: true, layaway: true },
      })
    })

    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.startsWith('OUT_OF_STOCK:')) {
      return NextResponse.json({ error: `Sin stock suficiente: ${msg.split(':')[1]}` }, { status: 409 })
    }
    if (msg.startsWith('PRODUCT_NOT_FOUND:')) {
      return NextResponse.json({ error: 'Uno de los productos ya no está disponible' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al registrar la venta' }, { status: 500 })
  }
}

/** GET /api/shop/pos/orders — ventas recientes de la tienda (vista del POS) */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const employee = await verifyEmployee(req, store.id)
  if (!employee) return unauthorizedEmployee()

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { items: true, payments: true, layaway: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ orders: orders.map(serializeOrder) })
}
