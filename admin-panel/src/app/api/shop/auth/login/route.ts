import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { signCustomerToken } from '@/lib/shop/customer-auth'

export async function POST(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()

  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: store.id, email: String(email).toLowerCase() } },
    })
    // Respuesta idéntica para email inexistente y contraseña incorrecta
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const token = await signCustomerToken({ customerId: customer.id, storeId: store.id })
    return NextResponse.json({
      token,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    })
  } catch {
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
