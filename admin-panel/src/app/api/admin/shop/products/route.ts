import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeProduct } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/** GET /api/admin/shop/products?storeId=... */
export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(req.url).searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })
  if (!canAccessStore(session, storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ products: products.map(serializeProduct) })
}

/** POST /api/admin/shop/products — crear producto */
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await req.json()
    if (!b.storeId || !b.name || b.price == null) {
      return NextResponse.json({ error: 'storeId, name y price son requeridos' }, { status: 400 })
    }
    if (!canAccessStore(session, b.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }
    const price = Number(b.price)
    if (!(price > 0)) return NextResponse.json({ error: 'price debe ser mayor a 0' }, { status: 400 })

    const product = await prisma.product.create({
      data: {
        storeId: b.storeId,
        name: b.name,
        description: b.description ?? '',
        price,
        imageUrl: b.imageUrl ?? '',
        category: b.category ?? 'general',
        sizes: Array.isArray(b.sizes) ? b.sizes.map(String) : [],
        stock: Number.isInteger(b.stock) && b.stock >= 0 ? b.stock : 0,
        isActive: b.isActive !== false,
      },
    })
    return NextResponse.json({ product: serializeProduct(product) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear el producto' }, { status: 500 })
  }
}
