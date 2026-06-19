import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { createPosSale, PosSaleError, type PosSaleItemInput } from '@/lib/shop/createPosSale'

/**
 * POST /api/admin/shop/orders/pos — venta de mostrador desde el POS embebido en el panel admin.
 * Body: { storeId, items: [{productId, quantity, size?}] }
 * Sesión NextAuth en vez de X-Tenant-Key/JWT de empleado: el POS vive dentro de /admin,
 * ya protegido por el layout admin. Se registra PAID de inmediato (efectivo en mostrador).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { storeId?: string; items?: PosSaleItemInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const storeId = body.storeId
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })

  const items = (body.items ?? []).filter(
    (i) => i?.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 50
  )
  if (items.length === 0 || items.length > 30) {
    return NextResponse.json({ error: 'La venta debe tener entre 1 y 30 artículos válidos' }, { status: 400 })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

  try {
    const order = await createPosSale(storeId, items)
    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
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
    return NextResponse.json({ error: 'Error al registrar la venta' }, { status: 500 })
  }
}
