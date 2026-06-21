import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeProduct } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/** PUT /api/admin/shop/products/:id — actualizar (toca updatedAt → la app lo sincroniza) */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await prisma.product.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    if (!canAccessStore(session, existing.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }

    const b = await req.json()
    const data: Record<string, unknown> = {}
    if (b.name !== undefined) data.name = b.name
    if (b.description !== undefined) data.description = b.description
    if (b.price !== undefined) {
      const price = Number(b.price)
      if (!(price > 0)) return NextResponse.json({ error: 'price debe ser mayor a 0' }, { status: 400 })
      data.price = price
    }
    if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl
    if (b.category !== undefined) data.category = b.category
    if (Array.isArray(b.sizes)) data.sizes = b.sizes.map(String)
    if (b.stock !== undefined && Number.isInteger(b.stock) && b.stock >= 0) data.stock = b.stock
    if (b.isActive !== undefined) data.isActive = Boolean(b.isActive)

    const product = await prisma.product.update({ where: { id: params.id }, data })
    return NextResponse.json(serializeProduct(product))
  } catch {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
}

/** DELETE — soft delete: isActive=false (la app lo elimina de Room en el siguiente sync) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await prisma.product.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    if (!canAccessStore(session, existing.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }

    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
}
