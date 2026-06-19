import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { signEmployeeToken } from '@/lib/shop/employee-auth'

/** POST /api/shop/employees/login — login del POS web (dueño/empleados de mostrador) */
export async function POST(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()

  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({
      where: { storeId_email: { storeId: store.id, email: String(email).toLowerCase() } },
    })
    if (
      !employee ||
      !employee.active ||
      !(await bcrypt.compare(password, employee.passwordHash))
    ) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const token = await signEmployeeToken({
      employeeId: employee.id,
      storeId: store.id,
      role: employee.role,
    })
    return NextResponse.json({
      token,
      employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
    })
  } catch {
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
