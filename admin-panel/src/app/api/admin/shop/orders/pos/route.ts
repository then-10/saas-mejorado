import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { createPosSale, PosSaleError, type PosSaleItemInput } from '@/lib/shop/createPosSale'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

const VALID_PAYMENT_METHODS = ['CASH_IN_STORE', 'CARD', 'TRANSFER'] as const

/**
 * POST /api/admin/shop/orders/pos — venta de mostrador desde el POS embebido en el panel admin.
 * Body: { storeId, items: [{productId, quantity, size?}], customerName, paymentMethod, isLayaway?, depositAmount? }
 * Sesión NextAuth en vez de X-Tenant-Key/JWT de empleado: el POS vive dentro de /admin,
 * ya protegido por el layout admin. "Tarjeta"/"Transferencia" son solo etiquetas de registro
 * (el dueño ya cobró fuera de la app); "Apartado" crea un Layaway con el depósito que el dueño escribe.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    storeId?: string
    items?: PosSaleItemInput[]
    customerName?: string
    paymentMethod?: string
    isLayaway?: boolean
    depositAmount?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const storeId = body.storeId
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })
  if (!canAccessStore(session, storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const items = (body.items ?? []).filter(
    (i) => i?.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 50
  )
  if (items.length === 0 || items.length > 30) {
    return NextResponse.json({ error: 'La venta debe tener entre 1 y 30 artículos válidos' }, { status: 400 })
  }

  const customerName = body.customerName?.trim()
  if (!customerName) {
    return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 })
  }

  const paymentMethod = body.paymentMethod
  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: 'Forma de pago inválida' }, { status: 400 })
  }

  const isLayaway = body.isLayaway === true
  const depositAmount = typeof body.depositAmount === 'number' ? body.depositAmount : 0
  if (isLayaway && !(depositAmount > 0)) {
    return NextResponse.json({ error: 'El depósito debe ser mayor a 0 para un apartado' }, { status: 400 })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

  try {
    const order = await createPosSale(storeId, {
      items,
      customerName,
      paymentMethod: paymentMethod as 'CASH_IN_STORE' | 'CARD' | 'TRANSFER',
      isLayaway,
      depositAmount,
    })
    await prisma.activityLog.create({
      data: {
        adminId: session.user.id ?? null,
        action: 'POS_SALE',
        entityType: 'Order',
        entityId: order.id,
        details: `Venta de mostrador por $${order.total} en ${store.name}`,
      },
    })
    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 })
  } catch (e) {
    if (e instanceof PosSaleError && e.code === 'OUT_OF_STOCK') {
      return NextResponse.json({ error: `Sin stock suficiente: ${e.detail}` }, { status: 409 })
    }
    if (e instanceof PosSaleError && e.code === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Uno de los productos ya no está disponible' }, { status: 409 })
    }
    if (e instanceof PosSaleError && e.code === 'INVALID_DEPOSIT') {
      return NextResponse.json({ error: e.detail }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al registrar la venta' }, { status: 500 })
  }
}
