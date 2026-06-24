import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url')
}

/**
 * GET /api/admin/shop/stores/:id/owner — email actual del dueño (app del
 * dueño + POS web). Nunca expone el hash de la contraseña.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const owner = await prisma.employee.findFirst({
    where: { storeId: params.id, role: 'OWNER' },
    select: { id: true, email: true, active: true },
  })
  if (!owner) return NextResponse.json({ error: 'Dueño no encontrado' }, { status: 404 })

  return NextResponse.json({ owner })
}

/**
 * PATCH /api/admin/shop/stores/:id/owner — actualizar el email y/o resetear
 * la contraseña del dueño. Estas credenciales son las que usan la app
 * Android del dueño (login NextAuth) y el POS web (/tienda).
 * Body: { email?: string, resetPassword?: boolean }
 * La contraseña temporal generada se devuelve una sola vez en la respuesta.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const b = await req.json().catch(() => null)
  if (!b || (typeof b.email !== 'string' && b.resetPassword !== true)) {
    return NextResponse.json({ error: 'email y/o resetPassword es requerido' }, { status: 400 })
  }

  const owner = await prisma.employee.findFirst({ where: { storeId: params.id, role: 'OWNER' } })
  if (!owner) return NextResponse.json({ error: 'Dueño no encontrado' }, { status: 404 })

  const data: Record<string, string> = {}

  if (typeof b.email === 'string' && b.email.trim()) {
    const email = b.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    const taken = await prisma.employee.findUnique({
      where: { storeId_email: { storeId: params.id, email } },
    })
    if (taken && taken.id !== owner.id) {
      return NextResponse.json({ error: 'Ese email ya está en uso en esta tienda' }, { status: 409 })
    }
    data.email = email
  }

  let tempPassword: string | undefined
  if (b.resetPassword === true) {
    tempPassword = generateTempPassword()
    data.passwordHash = await bcrypt.hash(tempPassword, 10)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const updated = await prisma.employee.update({ where: { id: owner.id }, data })

  await prisma.activityLog.create({
    data: {
      adminId: session.user.id ?? null,
      action: tempPassword ? 'OWNER_PASSWORD_RESET' : 'OWNER_EMAIL_UPDATED',
      entityType: 'Store',
      entityId: params.id,
      details: tempPassword
        ? `Contraseña del dueño restablecida (${updated.email})`
        : `Email del dueño actualizado a ${updated.email}`,
    },
  })

  return NextResponse.json({
    owner: { email: updated.email },
    ...(tempPassword ? { tempPassword } : {}),
  })
}
