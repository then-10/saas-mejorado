import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { verifyEmployee, unauthorizedEmployee } from '@/lib/shop/employee-auth'

const MIN_PASSWORD_LENGTH = 8

/**
 * PATCH /api/shop/employees/me/password — el empleado/dueño autenticado cambia su propia
 * contraseña desde el POS web, conociendo la actual.
 * Body: { currentPassword: string, newPassword: string }
 */
export async function PATCH(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()
  const employee = await verifyEmployee(req, store.id)
  if (!employee) return unauthorizedEmployee()

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { currentPassword, newPassword } = body
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword y newPassword son requeridos' },
      { status: 400 }
    )
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 }
    )
  }

  const record = await prisma.employee.findFirst({
    where: { id: employee.employeeId, storeId: store.id },
  })
  if (!record) return unauthorizedEmployee()

  const matches = await bcrypt.compare(currentPassword, record.passwordHash)
  if (!matches) {
    return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.employee.update({
    where: { id: record.id },
    data: { passwordHash },
  })

  return NextResponse.json({ ok: true })
}
