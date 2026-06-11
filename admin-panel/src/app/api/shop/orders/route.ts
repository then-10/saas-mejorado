import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { verifyCustomer, unauthorizedCustomer } from '@/lib/shop/customer-auth'
import { serializeOrder } from '@/lib/shop/serialize'

interface OrderItemInput {
  productId: string
  quantity: number
  size?: string
}

/**
 * POST /api/shop/orders
 * Body: { type: "PURCHASE" | "LAYAWAY", items: [{productId, quantity, size}], shippingInfo? }
 * Los precios SIEMPRE se toman de la base de datos, nunca del cliente.
 * El stock se descuenta de forma transaccional y condicional.
 */
export async function POST(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const customer = await verifyCustomer(req, store.id)
  if (!customer) return unauthorizedCustomer()

  let body: { type?: string; items?: OrderItemInput[]; shippingInfo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const type = body.type === 'LAYAWAY' ? 'LAYAWAY' : 'PURCHASE'
  const items = (body.items ?? []).filter(
    (i) => i?.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 50
  )
  if (items.length === 0 || items.length > 30) {
    return NextResponse.json({ error: 'El pedido debe tener entre 1 y 30 artículos válidos' }, { status: 400 })
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const ids = items.map((i) => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: ids }, storeId: store.id, isActive: true },
      })
      const byId = new Map<string, Product>(products.map((p: Product) => [p.id, p]))

      for (const item of items) {
        const p = byId.get(item.productId)
        if (!p) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`)
        // Decremento condicional: falla si no hay stock suficiente (evita sobreventa concurrente)
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
          customerId: customer.customerId,
          type,
          status: 'PENDING_PAYMENT',
          subtotal,
          total: subtotal, // envío/descuentos: Fase 3+
          shippingInfo: (body.shippingInfo as Prisma.InputJsonValue) ?? Prisma.JsonNull,
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
        },
      })

      if (type === 'LAYAWAY') {
        const deposit = subtotal.mul(store.layawayDepositPct).div(100).toDecimalPlaces(2)
        const dueDate = new Date(Date.now() + store.layawayDays * 24 * 60 * 60 * 1000)
        await tx.layaway.create({
          data: { orderId: created.id, depositAmount: deposit, dueDate },
        })
      }

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
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }
}

/** GET /api/shop/orders — pedidos del cliente autenticado */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const customer = await verifyCustomer(req, store.id)
  if (!customer) return unauthorizedCustomer()

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, customerId: customer.customerId },
    include: { items: true, payments: true, layaway: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ orders: orders.map(serializeOrder) })
}
