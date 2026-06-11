import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/shop/stores — lista de tiendas con su tenant key */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stores = await prisma.store.findMany({
    include: { client: { select: { name: true, email: true, status: true, plan: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ stores })
}

/**
 * POST /api/admin/shop/stores — activa el módulo e-commerce para un Client existente.
 * Body: { clientId, name?, paymentProvider?, layawayDepositPct?, layawayDays?, address? }
 * Genera el apiKey (X-Tenant-Key) que se configura en la app Android de esa tienda.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { clientId } = body
    if (!clientId) return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 })

    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const existing = await prisma.store.findUnique({ where: { clientId } })
    if (existing) return NextResponse.json({ error: 'Este cliente ya tiene tienda activa' }, { status: 409 })

    const store = await prisma.store.create({
      data: {
        clientId,
        apiKey: `tk_${randomBytes(24).toString('hex')}`,
        name: body.name ?? client.name,
        paymentProvider: body.paymentProvider === 'CONEKTA' ? 'CONEKTA' : 'MERCADO_PAGO',
        layawayDepositPct: clampInt(body.layawayDepositPct, 10, 100, 30),
        layawayDays: clampInt(body.layawayDays, 7, 90, 30),
        address: body.address ?? client.address,
      },
    })

    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: 'STORE_CREATED',
        entityType: 'Store',
        entityId: store.id,
        details: `Tienda e-commerce activada para ${client.name}`,
      },
    })

    return NextResponse.json({ store }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear la tienda' }, { status: 500 })
  }
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v)
  if (!Number.isInteger(n)) return def
  return Math.min(max, Math.max(min, n))
}
