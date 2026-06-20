import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptField } from '@/lib/shop/payments/encryption'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

/**
 * GET /api/admin/shop/stores/:id — detalle de la tienda (sin secretos)
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const store = await prisma.store.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, currency: true, paymentProvider: true,
      layawayDepositPct: true, layawayDays: true, address: true,
      // Booleans que indican si hay llave configurada, sin exponerla
      mpAccessTokenEnc: true, conektaKeyEnc: true,
    },
  })
  if (!store) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

  const { mpAccessTokenEnc, conektaKeyEnc, ...rest } = store
  return NextResponse.json({
    store: {
      ...rest,
      hasMpKey: Boolean(mpAccessTokenEnc),
      hasConektaKey: Boolean(conektaKeyEnc),
    },
  })
}

/**
 * PUT /api/admin/shop/stores/:id — actualizar configuración.
 * Acepta: { name?, paymentProvider?, layawayDepositPct?, layawayDays?, address?,
 *          mpAccessToken?, conektaKey? }
 * Las llaves del proveedor se cifran con encryptField antes de guardar; nunca se devuelven.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  try {
    const b = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim()
    if (b.paymentProvider === 'MERCADO_PAGO' || b.paymentProvider === 'CONEKTA') {
      data.paymentProvider = b.paymentProvider
    }
    if (typeof b.address === 'string') data.address = b.address || null

    if (b.layawayDepositPct !== undefined) {
      const n = Number(b.layawayDepositPct)
      if (!Number.isInteger(n) || n < 10 || n > 100) {
        return NextResponse.json({ error: 'layawayDepositPct debe ser entero entre 10 y 100' }, { status: 400 })
      }
      data.layawayDepositPct = n
    }
    if (b.layawayDays !== undefined) {
      const n = Number(b.layawayDays)
      if (!Number.isInteger(n) || n < 7 || n > 90) {
        return NextResponse.json({ error: 'layawayDays debe ser entero entre 7 y 90' }, { status: 400 })
      }
      data.layawayDays = n
    }

    // Llaves de pago: cifradas antes de almacenar
    if (typeof b.mpAccessToken === 'string' && b.mpAccessToken.trim()) {
      data.mpAccessTokenEnc = encryptField(b.mpAccessToken.trim())
    }
    if (typeof b.conektaKey === 'string' && b.conektaKey.trim()) {
      data.conektaKeyEnc = encryptField(b.conektaKey.trim())
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    await prisma.store.update({ where: { id: params.id }, data })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Tienda no encontrada o datos inválidos' }, { status: 404 })
  }
}
