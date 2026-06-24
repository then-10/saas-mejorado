import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/shop/admin-session'

/**
 * PATCH /api/admin/shop/employees/me/password — el dueño/empleado logueado
 * (sesión NextAuth, app del dueño) cambia su propia contraseña sabiendo la
 * actual. Si la pierde, el flujo de recuperación es el reset desde el SaaS
 * (PATCH /api/admin/shop/stores/[id]/owner con resetPassword:true).
 * Body: { currentPassword: string, newPassword: string }
 */
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.type !== 'employee') {
    return NextResponse.json({ error: 'Solo disponible para cuentas de tienda' }, { status: 403 })
  }

  const b = await req.json().catch(() => null)
  if (typeof b?.currentPassword !== 'string' || typeof b?.newPassword !== 'string') {
    return NextResponse.json(
      { error: 'currentPassword y newPassword (string) son requeridos' },
      { status: 400 }
    )
  }
  if (b.newPassword.length < 8) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const employee = await prisma.employee.findUnique({ where: { id: session.user.id } })
  if (!employee) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  const valid = await bcrypt.compare(b.currentPassword, employee.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })

  await prisma.employee.update({
    where: { id: employee.id },
    data: { passwordHash: await bcrypt.hash(b.newPassword, 10) },
  })

  return NextResponse.json({ ok: true })
}
