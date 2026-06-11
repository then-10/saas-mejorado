import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { serializeProduct } from '@/lib/shop/serialize'

/**
 * GET /api/shop/products?updatedAfter=2026-06-01T00:00:00Z
 * Sync incremental: la app guarda el último sync y pide solo cambios.
 * Incluye productos inactivos cuando hay updatedAfter para que la app
 * pueda removerlos de su Room local.
 */
export async function GET(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()

  const { searchParams } = new URL(req.url)
  const updatedAfter = searchParams.get('updatedAfter')

  const where: Record<string, unknown> = { storeId: store.id }
  if (updatedAfter) {
    const date = new Date(updatedAfter)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'updatedAfter inválido (usa ISO-8601)' }, { status: 400 })
    }
    where.updatedAt = { gt: date }
  } else {
    where.isActive = true
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'asc' },
    take: 500,
  })

  return NextResponse.json({
    products: products.map(serializeProduct),
    serverTime: new Date().toISOString(), // la app lo guarda como lastSync
  })
}
