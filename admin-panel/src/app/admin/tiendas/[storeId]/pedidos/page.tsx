import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUSES = [
  'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_PICKUP',
  'SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED',
]
const TYPES = ['PURCHASE', 'LAYAWAY']

function statusBadgeClass(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT': return 'bg-amber-100 text-amber-800'
    case 'PAID': return 'bg-blue-100 text-blue-800'
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
    case 'SHIPPED': return 'bg-indigo-100 text-indigo-800'
    case 'DELIVERED': return 'bg-green-100 text-green-800'
    case 'CANCELLED':
    case 'EXPIRED': return 'bg-gray-200 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}
function statusLabel(s: string) {
  return ({
    PENDING_PAYMENT: 'Pendiente de pago', PAID: 'Pagado', PREPARING: 'Preparando',
    READY_FOR_PICKUP: 'Listo para recoger', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado', EXPIRED: 'Vencido',
  } as Record<string, string>)[s] ?? s
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: { storeId: string }
  searchParams: { status?: string; type?: string; page?: string }
}) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
  if (!store) notFound()

  const where: Prisma.OrderWhereInput = { storeId: params.storeId }
  if (searchParams.status && STATUSES.includes(searchParams.status)) where.status = searchParams.status as Prisma.OrderWhereInput['status']
  if (searchParams.type && TYPES.includes(searchParams.type)) where.type = searchParams.type as Prisma.OrderWhereInput['type']

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const pageSize = 25

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { select: { quantity: true } },
        customer: { select: { name: true, email: true } },
        layaway: { select: { status: true, paidAmount: true, dueDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Helper para mantener filtros en links
  const qs = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...searchParams, ...overrides })) {
      if (v !== undefined && v !== '') sp.set(k, String(v))
    }
    const s = sp.toString()
    return s ? `?${s}` : ''
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/tiendas/${params.storeId}`} className="text-xs text-gray-500 hover:text-gray-700">
          ← {store.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Pedidos</h1>
        <p className="text-sm text-gray-500">{total} pedido{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'}</p>
      </header>

      {/* Filtros */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase text-gray-500 tracking-wider">Estado:</span>
        <Link
          href={`/admin/tiendas/${params.storeId}/pedidos${qs({ status: undefined, page: 1 })}`}
          className={`text-xs px-3 py-1 rounded-full ${!searchParams.status ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >Todos</Link>
        {STATUSES.map((s) => (
          <Link key={s}
            href={`/admin/tiendas/${params.storeId}/pedidos${qs({ status: s, page: 1 })}`}
            className={`text-xs px-3 py-1 rounded-full ${searchParams.status === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >{statusLabel(s)}</Link>
        ))}
        <span className="text-xs uppercase text-gray-500 tracking-wider ml-auto">Tipo:</span>
        <Link
          href={`/admin/tiendas/${params.storeId}/pedidos${qs({ type: undefined, page: 1 })}`}
          className={`text-xs px-3 py-1 rounded-full ${!searchParams.type ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >Ambos</Link>
        {TYPES.map((t) => (
          <Link key={t}
            href={`/admin/tiendas/${params.storeId}/pedidos${qs({ type: t, page: 1 })}`}
            className={`text-xs px-3 py-1 rounded-full ${searchParams.type === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >{t === 'PURCHASE' ? 'Compra' : 'Apartado'}</Link>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Pedido</th>
              <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
              <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin pedidos para estos filtros.</td></tr>
            ) : orders.map((o) => {
              const itemCount = o.items.reduce((a, i) => a + i.quantity, 0)
              return (
                <tr key={o.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customer.name}</div>
                    <div className="text-xs text-gray-500">{o.customer.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {o.type === 'LAYAWAY' ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">Apartado</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">Compra</span>
                    )}
                    <div className="text-xs text-gray-500 mt-1">{itemCount} art.</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeClass(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${Number(o.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    {o.layaway && (
                      <div className="text-xs text-gray-500 font-normal">
                        Abonado: ${Number(o.layaway.paidAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {o.createdAt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tiendas/${params.storeId}/pedidos/${o.id}`}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >Ver →</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/tiendas/${params.storeId}/pedidos${qs({ page: page - 1 })}`}
                className="px-3 py-1 border rounded hover:bg-gray-50"
              >Anterior</Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/tiendas/${params.storeId}/pedidos${qs({ page: page + 1 })}`}
                className="px-3 py-1 border rounded hover:bg-gray-50"
              >Siguiente</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
