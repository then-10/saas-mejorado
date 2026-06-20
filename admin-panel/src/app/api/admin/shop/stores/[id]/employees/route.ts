import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url')
}

/**
 * GET /api/admin/shop/stores/:id/employees — credenciales de la tienda
 * (dueño/staff) que puede administrar el super-admin o el propio dueño.
 * Nunca devuelve el hash de contraseña.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const employees = await prisma.employee.findMany({
    where: { storeId: params.id },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ employees })
}

/**
 * POST /api/admin/shop/stores/:id/employees — crea una credencial nueva
 * (dueño u otro empleado) para la tienda. Devuelve la contraseña temporal
 * una sola vez en la respuesta.
 * Body: { name, email, role? }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessStore(session, params.id)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  try {
    const b = await req.json()
    if (!b.name || !b.email) {
      return NextResponse.json({ error: 'name y email son requeridos' }, { status: 400 })
    }
    const email = String(b.email).toLowerCase()
    const role = b.role === 'STAFF' ? 'STAFF' : 'OWNER'
    const tempPassword = generateTempPassword()

    const employee = await prisma.employee.create({
      data: {
        storeId: params.id,
        name: String(b.name),
        email,
        passwordHash: await bcrypt.hash(tempPassword, 10),
        role,
      },
    })

    return NextResponse.json(
      {
        employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role, active: employee.active },
        tempPassword,
      },
      { status: 201 }
    )
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un empleado con ese email en esta tienda' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al crear el empleado' }, { status: 500 })
  }
}
