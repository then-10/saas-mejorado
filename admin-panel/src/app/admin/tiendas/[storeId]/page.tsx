import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getStoreOverview(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { client: { select: { name: true, email: true } } },
  })
  if (!store) return null

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [
    ordersTotal,
    ordersPending,
    ordersPaidLast30,
    revenueLast30,
    productsActive,
    productsLowStock,
    layawaysActive,
    layawaysDueSoon,
  ] = await Promise.all([
    prisma.order.count({ where: { storeId } }),
    prisma.order.count({ where: { storeId, status: 'PENDING_PAYMENT' } }),
    prisma.order.count({ where: { storeId, status: 'PAID', createdAt: { gte: since30d } } }),
    prisma.order.aggregate({
      where: { storeId, status: 'PAID', createdAt: { gte: since30d } },
      _sum: { total: true },
    }),
    prisma.product.count({ where: { storeId, isActive: true } }),
    prisma.product.count({ where: { storeId, isActive: true, stock: { lte: 5 } } }),
    prisma.layaway.count({ where: { status: 'ACTIVE', order: { storeId } } }),
    prisma.layaway.count({
      where: {
        status: 'ACTIVE',
        order: { storeId },
        dueDate: { lte: new Date(Date.now() + 72 * 60 * 60 * 1000) },
      },
    }),
  ])

  return {
    store,
    kpis: {
      ordersTotal,
      ordersPending,
      ordersPaidLast30,
      revenueLast30: Number(revenueLast30._sum.total ?? 0),
      productsActive,
      productsLowStock,
      layawaysActive,
      layawaysDueSoon,
    },
  }
}

export default async function StoreOverviewPage({ params }: { params: { storeId: string } }) {
  const data = await getStoreOverview(params.storeId)
  if (!data) notFound()
  const { store, kpis } = data

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/admin/tiendas" className="text-xs text-gray-500 hover:text-gray-700">
            ← Todas las tiendas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{store.name}</h1>
          <p className="text-sm text-gray-500">
            {store.client.name} · {store.client.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">X-Tenant-Key</p>
          <code className="text-xs bg-gray-100 rounded px-2 py-1 select-all">{store.apiKey}</code>
        </div>
      </header>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Ingresos (30d)" value={`$${kpis.revenueLast30.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
        <Kpi label="Pedidos pagados (30d)" value={kpis.ordersPaidLast30} />
        <Kpi label="Pedidos totales" value={kpis.ordersTotal} />
        <Kpi label="Pendientes de pago" value={kpis.ordersPending} accent={kpis.ordersPending > 0 ? 'amber' : undefined} />
      </div>

      {/* Secciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SectionLink
          href={`/admin/tiendas/${store.id}/pedidos`}
          title="Pedidos"
          summary={`${kpis.ordersTotal} totales · ${kpis.ordersPending} pendientes`}
        />
        <SectionLink
          href={`/admin/tiendas/${store.id}/apartados`}
          title="Apartados"
          summary={`${kpis.layawaysActive} activos · ${kpis.layawaysDueSoon} por vencer (≤72h)`}
          highlight={kpis.layawaysDueSoon > 0}
        />
        <SectionLink
          href={`/admin/tiendas/${store.id}/productos`}
          title="Productos"
          summary={`${kpis.productsActive} activos · ${kpis.productsLowStock} con stock bajo (≤5)`}
          highlight={kpis.productsLowStock > 0}
        />
        <SectionLink
          href={`/admin/tiendas/${store.id}/ventas`}
          title="Ventas"
          summary="Gráficas e ingresos por período"
        />
        <SectionLink
          href={`/admin/tiendas/${store.id}/configuracion`}
          title="Configuración"
          summary="Apartados, proveedor de pagos y datos generales"
        />
        <SectionLink
          href={`/admin/tiendas/${store.id}/pos`}
          title="Punto de venta"
          summary="Registra ventas de mostrador en tiempo real"
        />
      </div>

      {/* Config de la tienda */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Configuración</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Proveedor de pago</dt>
            <dd className="font-medium">{store.paymentProvider}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Anticipo de apartado</dt>
            <dd className="font-medium">{store.layawayDepositPct}%</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Plazo de apartado</dt>
            <dd className="font-medium">{store.layawayDays} días</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Dirección</dt>
            <dd className="font-medium">{store.address || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: 'amber' }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${accent === 'amber' ? 'border-amber-300' : ''}`}>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent === 'amber' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function SectionLink({
  href, title, summary, highlight,
}: { href: string; title: string; summary: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`block bg-white rounded-lg border p-5 hover:border-indigo-500 hover:shadow-sm transition ${
        highlight ? 'border-amber-300' : ''
      }`}
    >
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className={`text-sm mt-1 ${highlight ? 'text-amber-700' : 'text-gray-500'}`}>{summary}</p>
    </Link>
  )
}
