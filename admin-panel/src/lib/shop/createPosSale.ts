import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findOrCreateNamedCustomer } from './customers'

export interface PosSaleItemInput {
  productId: string
  quantity: number
  size?: string
}

export interface PosSaleInput {
  items: PosSaleItemInput[]
  customerName: string
  paymentMethod: 'CASH_IN_STORE' | 'CARD' | 'TRANSFER'
  isLayaway?: boolean
  depositAmount?: number
  /** Fecha de la venta; permite backdatear (seed de datos demo). Default: ahora. */
  occurredAt?: Date
}

export class PosSaleError extends Error {
  constructor(public code: 'OUT_OF_STOCK' | 'PRODUCT_NOT_FOUND' | 'INVALID_DEPOSIT', public detail: string) {
    super(`${code}:${detail}`)
  }
}

/**
 * Venta de mostrador desde el POS embebido en el panel admin: descuento de stock
 * transaccional, vínculo a un Customer real (por nombre) y registro de Order+Payment,
 * con soporte para apartado (Layaway) con depósito ingresado a mano por el dueño.
 */
export async function createPosSale(storeId: string, input: PosSaleInput) {
  const { items, customerName, paymentMethod, isLayaway = false, depositAmount = 0 } = input

  return prisma.$transaction(async (tx) => {
    const customer = await findOrCreateNamedCustomer(tx, storeId, customerName)

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
      await tx.stockMovement.create({
        data: { productId: p.id, storeId, delta: -item.quantity, reason: 'VENTA' },
      })
    }

    const subtotal = items.reduce((acc: Prisma.Decimal, item) => {
      const p = byId.get(item.productId)!
      return acc.add(new Prisma.Decimal(p.price).mul(item.quantity))
    }, new Prisma.Decimal(0))

    const depositDecimal = new Prisma.Decimal(depositAmount || 0)
    if (isLayaway && (depositDecimal.lte(0) || depositDecimal.gt(subtotal))) {
      throw new PosSaleError('INVALID_DEPOSIT', 'El depósito debe ser mayor a 0 y no exceder el total')
    }
    const paidAmount = isLayaway ? depositDecimal : subtotal

    const created = await tx.order.create({
      data: {
        storeId,
        customerId: customer.id,
        type: isLayaway ? 'LAYAWAY' : 'PURCHASE',
        status: isLayaway ? 'PENDING_PAYMENT' : 'PAID',
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
            method: paymentMethod,
            status: 'PAID',
            amount: paidAmount,
            paidAt: new Date(),
          },
        },
        ...(isLayaway
          ? {
              layaway: {
                create: {
                  depositAmount: depositDecimal,
                  paidAmount: depositDecimal,
                  dueDate: await (async () => {
                    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } })
                    const due = new Date()
                    due.setDate(due.getDate() + store.layawayDays)
                    return due
                  })(),
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      },
    })

    return tx.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, payments: true, layaway: true, customer: true },
    })
  })
}
