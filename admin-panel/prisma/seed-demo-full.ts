/**
 * Seed de datos demo realistas para una tienda existente: clientes con nombre,
 * historial de ventas (mixto: compras de contado, apartados activos/vencidos/
 * completados, distintos métodos de pago) repartido en los últimos 60 días.
 * No crea productos — usa los que ya existan en la tienda (ver seed-shop.ts).
 *
 * Uso: npx tsx prisma/seed-demo-full.ts <storeId>
 */
import { PrismaClient } from '@prisma/client'
import { createPosSale } from '../src/lib/shop/createPosSale'

const prisma = new PrismaClient()

const NOMBRES = [
  'Ana García', 'Luis Hernández', 'María López', 'Carlos Martínez', 'Sofía Ramírez',
  'Jorge Pérez', 'Daniela Torres', 'Miguel Sánchez', 'Valeria Cruz', 'Ricardo Flores',
  'Paola Jiménez', 'Fernando Vázquez', 'Andrea Morales', 'Roberto Castillo', 'Gabriela Reyes',
  'Alejandro Ortiz', 'Lucía Mendoza', 'Diego Romero', 'Camila Aguilar', 'Sergio Domínguez',
  'Patricia Núñez', 'Iván Ríos', 'Mariana Soto', 'Pablo Guerrero', 'Elena Campos',
]

const METODOS = ['CASH_IN_STORE', 'CARD', 'TRANSFER'] as const

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

async function main() {
  const storeId = process.argv[2]
  if (!storeId) {
    console.error('Uso: npx tsx prisma/seed-demo-full.ts <storeId>')
    process.exit(1)
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) {
    console.error(`Store ${storeId} no encontrado`)
    process.exit(1)
  }

  const products = await prisma.product.findMany({ where: { storeId, isActive: true } })
  if (products.length === 0) {
    console.error('La tienda no tiene productos activos; corre primero un seed de catálogo.')
    process.exit(1)
  }

  const nombresAUsar = NOMBRES.slice(0, randInt(15, 25))
  const ventasTotales = randInt(40, 80)
  let creadas = 0
  let fallidas = 0

  for (let i = 0; i < ventasTotales; i++) {
    const diasAtras = randInt(0, 59)
    const occurredAt = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
    occurredAt.setHours(randInt(9, 20), randInt(0, 59), 0, 0)

    const cantidadItems = randInt(1, 3)
    const itemsElegidos = new Set<string>()
    while (itemsElegidos.size < Math.min(cantidadItems, products.length)) {
      itemsElegidos.add(pick(products).id)
    }
    const items = Array.from(itemsElegidos).map((productId) => {
      const product = products.find((p) => p.id === productId)!
      const sizes = product.sizes
      return {
        productId,
        quantity: randInt(1, 3),
        size: sizes.length > 0 ? pick(sizes) : undefined,
      }
    })

    // ~20% apartado, resto compra de contado
    const isLayaway = Math.random() < 0.2
    let depositAmount: number | undefined
    if (isLayaway) {
      const subtotalEstimado = items.reduce((acc, it) => {
        const p = products.find((pr) => pr.id === it.productId)!
        return acc + Number(p.price) * it.quantity
      }, 0)
      depositAmount = Math.round(subtotalEstimado * (randInt(30, 60) / 100) * 100) / 100
    }

    try {
      await createPosSale(storeId, {
        items,
        customerName: pick(nombresAUsar),
        paymentMethod: pick([...METODOS]),
        isLayaway,
        depositAmount,
        occurredAt,
      })
      creadas++
    } catch {
      // stock insuficiente u otro motivo esperable con datos aleatorios; se omite
      fallidas++
    }
  }

  // Vencer manualmente algunos apartados activos antiguos para tener casos "overdue" en Reportes
  const apartadosActivos = await prisma.layaway.findMany({
    where: { order: { storeId }, status: 'ACTIVE' },
    select: { id: true, dueDate: true },
  })
  const aVencer = apartadosActivos.slice(0, Math.ceil(apartadosActivos.length / 3))
  for (const l of aVencer) {
    await prisma.layaway.update({
      where: { id: l.id },
      data: { dueDate: new Date(Date.now() - randInt(1, 10) * 24 * 60 * 60 * 1000) },
    })
  }

  console.log(`✅ Seed demo completado para store ${storeId}`)
  console.log(`   Ventas creadas: ${creadas} (omitidas por stock: ${fallidas})`)
  console.log(`   Clientes usados: ${nombresAUsar.length}`)
  console.log(`   Apartados marcados como vencidos: ${aVencer.length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
