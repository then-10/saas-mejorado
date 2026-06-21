import type { Product, Order, OrderItem, Payment, Layaway, Customer } from '@prisma/client'

/** Prisma Decimal -> number para JSON limpio hacia la app Android. */
export const dec = (d: unknown) => Number(d)

export function serializeProduct(p: Product) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: dec(p.price),
    imageUrl: p.imageUrl,
    category: p.category,
    sizes: p.sizes,
    rating: p.rating,
    stock: p.stock,
    isActive: p.isActive,
    updatedAt: p.updatedAt.toISOString(),
  }
}

type FullOrder = Order & {
  items: OrderItem[]
  payments: Payment[]
  layaway: Layaway | null
  customer?: Pick<Customer, 'id' | 'name'> | null
}

export function serializeOrder(o: FullOrder) {
  return {
    id: o.id,
    type: o.type,
    status: o.status,
    subtotal: dec(o.subtotal),
    total: dec(o.total),
    shippingInfo: o.shippingInfo,
    createdAt: o.createdAt.toISOString(),
    customer: o.customer ? { id: o.customer.id, name: o.customer.name } : null,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: dec(i.unitPrice),
      quantity: i.quantity,
      size: i.size,
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: dec(p.amount),
      reference: p.reference,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    layaway: o.layaway
      ? {
          depositAmount: dec(o.layaway.depositAmount),
          paidAmount: dec(o.layaway.paidAmount),
          dueDate: o.layaway.dueDate.toISOString(),
          status: o.layaway.status,
        }
      : null,
  }
}

export function serializeLayaway(l: {
  id: string
  orderId: string
  depositAmount: unknown
  paidAmount: unknown
  dueDate: Date
  status: string
  order?: {
    id: string
    total: unknown
    status: string
    createdAt: Date
    items?: { name: string; quantity: number }[]
    payments?: { id: string; amount: unknown; method: string; status: string; paidAt: Date | null }[]
  } | null
}) {
  return {
    id: l.id,
    orderId: l.orderId,
    depositAmount: dec(l.depositAmount),
    paidAmount: dec(l.paidAmount),
    dueDate: l.dueDate,
    status: l.status,
    order: l.order
      ? {
          id: l.order.id,
          total: dec(l.order.total),
          status: l.order.status,
          createdAt: l.order.createdAt,
          items: l.order.items ?? [],
          payments: (l.order.payments ?? []).map((p) => ({ ...p, amount: dec(p.amount) })),
        }
      : null,
  }
}
