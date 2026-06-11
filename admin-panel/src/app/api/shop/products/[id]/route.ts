import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { serializeProduct } from '@/lib/shop/serialize'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()

  const product = await prisma.product.findFirst({
    where: { id: params.id, storeId: store.id },
  })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  return NextResponse.json({ product: serializeProduct(product) })
}
