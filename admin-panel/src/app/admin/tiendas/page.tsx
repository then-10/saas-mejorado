import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getStoresWithStats() {
  const stores = await prisma.store.findMany({
    include: {
      client: { select: { name: true, status: true, plan: true } },
      _count: { select: { orders: true, products: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // KPIs por tienda (en paralelo)
  return Promise.all(
    stores.map(async (s) => {
      const [pendingPayment, activeLayaways] = await Promise.all([
        prisma.order.count({ where: { storeId: s.id, status: 'PENDING_PAYMENT' } }),
        prisma.layaway.count({ where: { status: 'ACTIVE', order: { storeId: s.id } } }),
      ])
      return { ...s, pendingPayment, activeLayaways }
    })
  )
}

export default async function TiendasPage() {
  const stores = await getStoresWithStats()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Tiendas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Módulo e-commerce por tienda. Selecciona una para administrar pedidos, apartados y productos.
        </p>
      </header>

      {stores.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No hay tiendas activadas todavía. Actívalas desde la ficha del cliente.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/admin/tiendas/${s.id}`}
              className="block bg-white rounded-lg border p-5 hover:border-indigo-500 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  <p className="text-xs text-gray-500">{s.client.name}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    s.client.status === 'ACTIVO'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s.client.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Stat label="Pedidos" value={s._count.orders} />
                <Stat label="Productos" value={s._count.products} />
                <Stat label="Apartados activos" value={s.activeLayaways} />
              </dl>

              {s.pendingPayment > 0 && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                  {s.pendingPayment} pedido{s.pendingPayment === 1 ? '' : 's'} pendiente{s.pendingPayment === 1 ? '' : 's'} de pago
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-[10px] uppercase text-gray-500 tracking-wider">{label}</p>
    </div>
  )
}
