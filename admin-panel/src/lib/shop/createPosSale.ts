import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
}

export class PosSaleError extends Error {
  constructor(public code: 'OUT_OF_STOCK' | 'PRODUCT_NOT_FOUND' | 'INVALID_DEPOSIT', public detail: string) {
    super(`${code}:${detail}`)
  }
}

/** slug determinístico del nombre del cliente, usado para construir su email sintético. */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cliente'
}

/**
 * Busca o crea un Customer real a partir solo del nombre escrito por el dueño en el POS.
 * Como el schema exige email único + passwordHash, se sintetiza un email determinístico
 * por nombre+tienda (`<slug>.<storeId>@pos.local`) para que el mismo nombre reutilice
 * siempre el mismo Customer entre visitas (historial y deuda correctos en Clientes).
 */
async function findOrCreateNamedCustomer(
  tx: Prisma.TransactionClient,
  storeId: string,
  name: string,
) {
  const trimmedName = name.trim()
  const email = `${slugifyName(trimmedName)}.${storeId}@pos.local`
  return tx.customer.upsert({
    where: { storeId_email: { storeId, email } },
    update: {},
    create: {
      storeId,
      name: trimmedName,
      email,
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
    },
  })
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
