import bcrypt from 'bcryptjs'
import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface PosSaleItemInput {
  productId: string
  quantity: number
  size?: string
}

const WALK_IN_EMAIL = 'mostrador@pos.local'

export class PosSaleError extends Error {
  constructor(public code: 'OUT_OF_STOCK' | 'PRODUCT_NOT_FOUND', public detail: string) {
    super(`${code}:${detail}`)
  }
}

/**
 * Venta de mostrador (efectivo, PAID inmediato): descuento de stock transaccional
 * y registro de Order+Payment. Compartido entre el POS web del tenant (X-Tenant-Key
 * + empleado) y el POS embebido en el panel admin (sesión NextAuth).
 */
export async function createPosSale(storeId: string, items: PosSaleItemInput[]) {
  return prisma.$transaction(async (tx) => {
    const walkInCustomer = await tx.customer.upsert({
      where: { storeId_email: { storeId, email: WALK_IN_EMAIL } },
      update: {},
      create: {
        storeId,
        name: 'Venta de mostrador',
        email: WALK_IN_EMAIL,
        passwordHash: await bcrypt.hash(WALK_IN_EMAIL + storeId, 10),
      },
    })

    const ids = items.map((i) => i.productId)
    const products = await tx.product.findMany({
      where: { id: { in: ids }, storeId, isActive: true },
    })
    const byId = new Map<string, Product>(products.map((p: Product) => [p.id, p]))

    for (const item of items) {
      const p = byId.get(item.productId)
      if (!p) throw new PosSaleError('PRODUCT_NOT_FOUND', item.productId)
      const updated = await tx.product.updateMany({
        where: { id: p.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      })
      if (updated.count === 0) throw new PosSaleError('OUT_OF_STOCK', p.name)
    }

    const subtotal = items.reduce((acc: Prisma.Decimal, item) => {
      const p = byId.get(item.productId)!
      return acc.add(new Prisma.Decimal(p.price).mul(item.quantity))
    }, new Prisma.Decimal(0))

    const created = await tx.order.create({
      data: {
        storeId,
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
}
