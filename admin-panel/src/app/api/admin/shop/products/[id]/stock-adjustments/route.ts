import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeProduct } from '@/lib/shop/serialize'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * POST /api/admin/shop/products/:id/stock-adjustments  Body: { delta, reason, note? }
 * Ajuste de stock con motivo (conteo manual, merma, devolución), a diferencia
 * del PUT de producto que sobreescribe `stock` sin dejar rastro. Cada ajuste
 * queda registrado en StockMovement.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { delta, reason, note } = await req.json()
    const deltaNum = Number(delta)
    if (!Number.isInteger(deltaNum) || deltaNum === 0) {
      return NextResponse.json({ error: 'delta debe ser un entero distinto de 0' }, { status: 400 })
    }
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: 'reason es requerido' }, { status: 400 })
    }

    const existing = await prisma.product.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    if (!canAccessStore(session, existing.storeId)) {
      return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id: existing.id, stock: { gte: -deltaNum } },
        data: { stock: { increment: deltaNum } },
      })
      if (result.count === 0) {
        throw new Error('STOCK_NEGATIVE')
      }
      await tx.stockMovement.create({
        data: {
          productId: existing.id,
          storeId: existing.storeId,
          delta: deltaNum,
          reason: String(reason).trim(),
          note: note ? String(note) : null,
        },
      })
      return tx.product.findUniqueOrThrow({ where: { id: existing.id } })
    })

    return NextResponse.json(serializeProduct(updated))
  } catch (err) {
    if (err instanceof Error && err.message === 'STOCK_NEGATIVE') {
      return NextResponse.json({ error: 'El ajuste dejaría el stock en negativo' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error al ajustar el stock' }, { status: 500 })
  }
}
