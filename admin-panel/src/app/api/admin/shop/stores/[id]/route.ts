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
      layawayDepositPct: true, layawayDays: true, address: true, isActive: true,
      iaMarketingEnabled: true,
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

/**
 * PATCH /api/admin/shop/stores/:id — activar/desactivar el add-on App + POS
 * y/o la función de IA Marketing.
 * Body: { isActive?: boolean, iaMarketingEnabled?: boolean }
 * Solo el super-admin puede modificar estos flags:
 * - isActive: al desactivar, la app Android y el POS web dejan de poder
 *   autenticar (X-Tenant-Key rechazado en resolveStore), sin borrar datos.
 * - iaMarketingEnabled: habilita la generación de copys con IA para redes
 *   sociales en la app; el costo corre por cuenta del SaaS (plan intermedio).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.type === 'employee') {
    return NextResponse.json({ error: 'Solo el super-admin puede modificar esta configuración' }, { status: 403 })
  }

  const b = await req.json().catch(() => null)
  const data: Record<string, boolean> = {}
  if (typeof b?.isActive === 'boolean') data.isActive = b.isActive
  if (typeof b?.iaMarketingEnabled === 'boolean') data.iaMarketingEnabled = b.iaMarketingEnabled

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'isActive y/o iaMarketingEnabled (boolean) es requerido' },
      { status: 400 }
    )
  }

  try {
    const store = await prisma.store.update({
      where: { id: params.id },
      data,
    })

    if (typeof data.isActive === 'boolean') {
      await prisma.activityLog.create({
        data: {
          adminId: session.user.id ?? null,
          action: data.isActive ? 'STORE_REACTIVATED' : 'STORE_DEACTIVATED',
          entityType: 'Store',
          entityId: store.id,
          details: data.isActive
            ? `App + POS reactivado para ${store.name}`
            : `App + POS desactivado para ${store.name}`,
        },
      })
    }

    if (typeof data.iaMarketingEnabled === 'boolean') {
      await prisma.activityLog.create({
        data: {
          adminId: session.user.id ?? null,
          action: data.iaMarketingEnabled ? 'IA_MARKETING_ENABLED' : 'IA_MARKETING_DISABLED',
          entityType: 'Store',
          entityId: store.id,
          details: data.iaMarketingEnabled
            ? `IA Marketing activada para ${store.name}`
            : `IA Marketing desactivada para ${store.name}`,
        },
      })
    }

    return NextResponse.json({ ok: true, isActive: store.isActive, iaMarketingEnabled: store.iaMarketingEnabled })
  } catch {
    return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  }
}
