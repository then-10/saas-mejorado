import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SalesCharts } from './SalesCharts'

export const dynamic = 'force-dynamic'

type Range = 7 | 30 | 90

async function getSalesData(storeId: string, days: Range) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sinceDay = new Date(since)
  sinceDay.setHours(0, 0, 0, 0)

  // 1) Pedidos pagados en el rango (para revenue por día y total)
  const paidOrders = await prisma.order.findMany({
    where: { storeId, status: 'PAID', createdAt: { gte: sinceDay } },
    select: {
      total: true, createdAt: true, type: true,
      items: { select: { name: true, quantity: true, unitPrice: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 2) Pagos confirmados (para distribución por método)
  const paidPayments = await prisma.payment.findMany({
    where: {
      status: 'PAID',
      paidAt: { gte: sinceDay },
      order: { storeId },
    },
    select: { method: true, amount: true },
  })

  // ── Agregados ────────────────────────────────────────────────────────
  const totalRevenue = paidOrders.reduce((acc, o) => acc + Number(o.total), 0)
  const orderCount = paidOrders.length
  const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0

  // Revenue por día (todos los días del rango, incluso con 0)
  const byDayMap = new Map<string, { date: string; revenue: number; orders: number; layaways: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(sinceDay.getTime() + i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    byDayMap.set(key, { date: key, revenue: 0, orders: 0, layaways: 0 })
  }
  for (const o of paidOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    const bucket = byDayMap.get(key)
    if (bucket) {
      bucket.revenue += Number(o.total)
      bucket.orders += 1
      if (o.type === 'LAYAWAY') bucket.layaways += 1
    }
  }
  const revenueByDay = Array.from(byDayMap.values())

  // Distribución por método de pago
  const byMethod = new Map<string, number>()
  for (const p of paidPayments) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount))
  }
  const paymentsByMethod = Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount }))

  // Top 10 productos por unidades
  const productMap = new Map<string, { name: string; units: number; revenue: number }>()
  for (const o of paidOrders) {
    for (const it of o.items) {
      const cur = productMap.get(it.name) ?? { name: it.name, units: 0, revenue: 0 }
      cur.units += it.quantity
      cur.revenue += Number(it.unitPrice) * it.quantity
      productMap.set(it.name, cur)
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 10)

  return { totalRevenue, orderCount, avgTicket, revenueByDay, paymentsByMethod, topProducts }
}

export default async function VentasPage({
  params, searchParams,
}: {
  params: { storeId: string }
  searchParams: { range?: string }
}) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
  if (!store) notFound()

  const range: Range = searchParams.range === '7' ? 7 : searchParams.range === '90' ? 90 : 30
  const data = await getSalesData(params.storeId, range)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href={`/admin/tiendas/${params.storeId}`} className="text-xs text-gray-500 hover:text-gray-700">
            ← {store.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Ventas</h1>
          <p className="text-sm text-gray-500">Pedidos pagados en los últimos {range} días</p>
        </div>
        <nav className="flex gap-2">
          {([7, 30, 90] as Range[]).map((r) => (
            <Link
              key={r}
              href={`/admin/tiendas/${params.storeId}/ventas?range=${r}`}
              className={`text-xs px-3 py-1 rounded-full ${
                range === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >{r} días</Link>
          ))}
        </nav>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          label="Ingresos"
          value={`$${data.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
        />
        <Kpi label="Pedidos pagados" value={data.orderCount.toString()} />
        <Kpi
          label="Ticket promedio"
          value={`$${data.avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
        />
      </div>

      {data.orderCount === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Sin pedidos pagados en este rango. Cuando lleguen ventas, los gráficos aparecerán aquí.
        </div>
      ) : (
        <SalesCharts
          revenueByDay={data.revenueByDay}
          paymentsByMethod={data.paymentsByMethod}
          topProducts={data.topProducts}
        />
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
    </div>
  )
}
