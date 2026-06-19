import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url')
}

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
 * POST /api/admin/shop/stores — activa el add-on App + POS para un Client existente.
 * Body: { clientId, name?, paymentProvider?, layawayDepositPct?, layawayDays?, address?, monthlyPrice?, ownerEmail? }
 * Genera el apiKey (X-Tenant-Key) que usan la app Android y el POS web, y una cuenta
 * de empleado OWNER con contraseña temporal (se devuelve una sola vez en la respuesta).
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

    const ownerEmail = String(body.ownerEmail || client.email).toLowerCase()
    const tempPassword = generateTempPassword()

    const { store, employee } = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          clientId,
          apiKey: `tk_${randomBytes(24).toString('hex')}`,
          name: body.name ?? client.name,
          paymentProvider: body.paymentProvider === 'CONEKTA' ? 'CONEKTA' : 'MERCADO_PAGO',
          layawayDepositPct: clampInt(body.layawayDepositPct, 10, 100, 30),
          layawayDays: clampInt(body.layawayDays, 7, 90, 30),
          address: body.address ?? client.address,
          monthlyPrice: clampMoney(body.monthlyPrice, 499),
        },
      })
      const employee = await tx.employee.create({
        data: {
          storeId: store.id,
          name: `${client.name} (dueño)`,
          email: ownerEmail,
          passwordHash: await bcrypt.hash(tempPassword, 10),
          role: 'OWNER',
        },
      })
      return { store, employee }
    })

    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: 'STORE_CREATED',
        entityType: 'Store',
        entityId: store.id,
        details: `Add-on App + POS activado para ${client.name} ($${store.monthlyPrice}/mes)`,
      },
    })

    return NextResponse.json(
      {
        store,
        ownerCredentials: { email: employee.email, tempPassword },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Error al crear la tienda' }, { status: 500 })
  }
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v)
  if (!Number.isInteger(n)) return def
  return Math.min(max, Math.max(min, n))
}

function clampMoney(v: unknown, def: number): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.round(n * 100) / 100
}
