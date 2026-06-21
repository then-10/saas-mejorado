import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { verifyEmployee, unauthorizedEmployee } from '@/lib/shop/employee-auth'
import { serializeOrder } from '@/lib/shop/serialize'
import { createPosSale, PosSaleError, type PosSaleItemInput } from '@/lib/shop/createPosSale'

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

  let body: { items?: PosSaleItemInput[] }
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
    const order = await createPosSale(store.id, {
      items,
      customerName: 'Venta de mostrador',
      paymentMethod: 'CASH_IN_STORE',
      isLayaway: false,
    })
    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 })
  } catch (e) {
    if (e instanceof PosSaleError && e.code === 'OUT_OF_STOCK') {
      return NextResponse.json({ error: `Sin stock suficiente: ${e.detail}` }, { status: 409 })
    }
    if (e instanceof PosSaleError && e.code === 'PRODUCT_NOT_FOUND') {
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
    include: { items: true, payments: true, layaway: true, customer: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ orders: orders.map(serializeOrder) })
}
