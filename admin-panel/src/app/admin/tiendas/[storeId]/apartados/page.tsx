import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUSES = ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activos', COMPLETED: 'Liquidados', EXPIRED: 'Vencidos', CANCELLED: 'Cancelados',
}

export default async function LayawaysPage({
  params, searchParams,
}: {
  params: { storeId: string }
  searchParams: { status?: string }
}) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
  if (!store) notFound()

  const status = searchParams.status && STATUSES.includes(searchParams.status)
    ? searchParams.status
    : 'ACTIVE'

  const layaways = await prisma.layaway.findMany({
    where: { status: status as 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED', order: { storeId: params.storeId } },
    include: {
      order: {
        select: {
          id: true, total: true, createdAt: true,
          customer: { select: { name: true, email: true } },
          items: { select: { quantity: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 200,
  })

  const now = Date.now()
  const dueSoonThreshold = now + 72 * 60 * 60 * 1000

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/tiendas/${params.storeId}`} className="text-xs text-gray-500 hover:text-gray-700">
          ← {store.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Apartados</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s}
            href={`/admin/tiendas/${params.storeId}/apartados?status=${s}`}
            className={`text-xs px-3 py-1 rounded-full ${
              status === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >{STATUS_LABEL[s]}</Link>
        ))}
      </div>

      {layaways.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Sin apartados en estado {STATUS_LABEL[status].toLowerCase()}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {layaways.map((l) => {
            const total = Number(l.order.total)
            const paid = Number(l.paidAmount)
            const remaining = Math.max(0, total - paid)
            const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0
            const dueTs = l.dueDate.getTime()
            const isDueSoon = status === 'ACTIVE' && dueTs <= dueSoonThreshold
            const isOverdue = status === 'ACTIVE' && dueTs < now
            const itemCount = l.order.items.reduce((a, i) => a + i.quantity, 0)

            return (
              <Link
                key={l.id}
                href={`/admin/tiendas/${params.storeId}/pedidos/${l.order.id}`}
                className={`block bg-white rounded-lg border p-5 hover:shadow-sm transition ${
                  isOverdue ? 'border-red-300' : isDueSoon ? 'border-amber-300' : 'hover:border-indigo-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{l.order.customer.name}</p>
                    <p className="text-xs text-gray-500 truncate">{l.order.customer.email}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">{l.id.slice(0, 8)} · {itemCount} art.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Vence</p>
                    <p className={`text-sm font-medium ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-gray-900'}`}>
                      {l.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-gray-500">Abonado <span className="font-medium text-gray-900">${paid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></span>
                    <span className="text-gray-500">Resta <span className="font-medium text-gray-900">${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></span>
                    <span className="text-gray-500">Total <span className="font-medium text-gray-900">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                </div>

                {isOverdue && (
                  <p className="mt-3 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                    Vencido — el cron lo expirará en el próximo tick (o márcalo manualmente).
                  </p>
                )}
                {!isOverdue && isDueSoon && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    Vence en menos de 72 h — buen momento para contactar al cliente.
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
