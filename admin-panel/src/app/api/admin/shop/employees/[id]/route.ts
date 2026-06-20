import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url')
}

/**
 * PATCH /api/admin/shop/employees/:id — restablece contraseña y/o cambia
 * active/role de una credencial de tienda. Body: { resetPassword?, active?, role? }
 * Si resetPassword=true, devuelve la nueva contraseña temporal una sola vez.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await prisma.employee.findUnique({ where: { id: params.id } })
  if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  if (!canAccessStore(session, employee.storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  try {
    const b = await req.json()
    const data: Record<string, unknown> = {}
    let tempPassword: string | undefined

    if (b.resetPassword === true) {
      tempPassword = generateTempPassword()
      data.passwordHash = await bcrypt.hash(tempPassword, 10)
    }
    if (typeof b.active === 'boolean') data.active = b.active
    if (b.role === 'OWNER' || b.role === 'STAFF') data.role = b.role

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    const updated = await prisma.employee.update({ where: { id: params.id }, data })
    return NextResponse.json({
      employee: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active },
      ...(tempPassword ? { tempPassword } : {}),
    })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el empleado' }, { status: 500 })
  }
}

/** DELETE /api/admin/shop/employees/:id — elimina la credencial. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await prisma.employee.findUnique({ where: { id: params.id } })
  if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  if (!canAccessStore(session, employee.storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  await prisma.employee.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
