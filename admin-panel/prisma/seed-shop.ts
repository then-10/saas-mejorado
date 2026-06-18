/**
 * Seed del módulo e-commerce: crea (si no existen) un Client demo,
 * su Store con apiKey, un Customer de prueba y 8 productos.
 * Ejecutar: npx tsx prisma/seed-shop.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const client = await prisma.client.upsert({
    where: { email: 'demo@tiendaropa.mx' },
    update: {},
    create: {
      name: 'TiendaRopa Demo',
      email: 'demo@tiendaropa.mx',
      businessType: 'TIENDA_ROPA',
      plan: 'PROFESIONAL',
      status: 'PRUEBA',
      city: 'Villahermosa',
    },
  })

  let store = await prisma.store.findUnique({ where: { clientId: client.id } })
  if (!store) {
    store = await prisma.store.create({
      data: {
        clientId: client.id,
        apiKey: `tk_${randomBytes(24).toString('hex')}`,
        name: 'TiendaRopa Demo',
        paymentProvider: 'MERCADO_PAGO',
      },
    })
  }

  await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email: 'cliente@test.mx' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Cliente de Prueba',
      email: 'cliente@test.mx',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  })

  const productos = [
    { name: 'Playera básica blanca', price: 249.0, category: 'playeras', sizes: ['S', 'M', 'L', 'XL'], stock: 25 },
    { name: 'Jeans slim azul', price: 699.0, category: 'pantalones', sizes: ['28', '30', '32', '34'], stock: 15 },
    { name: 'Vestido floral verano', price: 549.0, category: 'vestidos', sizes: ['S', 'M', 'L'], stock: 10 },
    { name: 'Sudadera oversize gris', price: 459.0, category: 'sudaderas', sizes: ['M', 'L', 'XL'], stock: 18 },
    { name: 'Camisa de lino beige', price: 599.0, category: 'camisas', sizes: ['S', 'M', 'L'], stock: 12 },
    { name: 'Falda midi plisada', price: 429.0, category: 'faldas', sizes: ['S', 'M'], stock: 8 },
    { name: 'Chamarra de mezclilla', price: 899.0, category: 'chamarras', sizes: ['M', 'L'], stock: 6 },
    { name: 'Shorts deportivos negros', price: 299.0, category: 'shorts', sizes: ['S', 'M', 'L', 'XL'], stock: 30 },
  ]

  for (const p of productos) {
    const exists = await prisma.product.findFirst({ where: { storeId: store.id, name: p.name } })
    if (!exists) {
      await prisma.product.create({
        data: {
          storeId: store.id,
          ...p,
          description: `${p.name} — calidad premium, envío local en Villahermosa.`,
          rating: 4 + Math.round(Math.random() * 10) / 10,
        },
      })
    }
  }

  console.log('✅ Seed completado')
  console.log(`   Store ID:     ${store.id}`)
  console.log(`   X-Tenant-Key: ${store.apiKey}`)
  console.log('   Cliente app:  cliente@test.mx / password123')
}

main().finally(() => prisma.$disconnect())
