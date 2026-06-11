import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resolveStore, unauthorizedTenant } from '@/lib/shop/tenant'
import { signCustomerToken } from '@/lib/shop/customer-auth'

export async function POST(req: NextRequest) {
  const store = await resolveStore(req)
  if (!store) return unauthorizedTenant()

  try {
    const { name, email, password, phone } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const exists = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: store.id, email: email.toLowerCase() } },
    })
    if (exists) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
    }

    const customer = await prisma.customer.create({
      data: {
        storeId: store.id,
        name,
        email: email.toLowerCase(),
        phone: phone ?? null,
        passwordHash: await bcrypt.hash(password, 10),
      },
    })

    const token = await signCustomerToken({ customerId: customer.id, storeId: store.id })
    return NextResponse.json(
      { token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
  }
}
