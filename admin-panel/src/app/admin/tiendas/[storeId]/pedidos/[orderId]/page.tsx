import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'
import { OrderActions } from './OrderActions'

export const dynamic = 'force-dynamic'

const TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED', 'EXPIRED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'SHIPPED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago', PAID: 'Pagado', PREPARING: 'Preparando',
  READY_FOR_PICKUP: 'Listo para recoger', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado', EXPIRED: 'Vencido',
}

export default async function OrderDetailPage({ params }: { params: { storeId: string; orderId: string } }) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, storeId: params.storeId },
    include: {
      items: true, payments: true, layaway: true,
      customer: { select: { name: true, email: true, phone: true } },
      store: { select: { name: true } },
    },
  })
  if (!order) notFound()

  const data = serializeOrder(order)
  const allowed = TRANSITIONS[order.status] ?? []
  const remaining = order.layaway
    ? Math.max(0, Number(order.total) - Number(order.layaway.paidAmount))
    : null

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href={`/admin/tiendas/${params.storeId}/pedidos`} className="text-xs text-gray-500 hover:text-gray-700">
            ← Pedidos de {order.store.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Pedido <span className="font-mono">{order.id.slice(0, 8)}</span>
          </h1>
          <p className="text-sm text-gray-500">
            {order.createdAt.toLocaleString('es-MX')} ·{' '}
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
              {order.type === 'LAYAWAY' ? 'Apartado' : 'Compra'}
            </span>
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 font-medium">
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal: ítems + pagos */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-lg border">
            <header className="px-5 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Artículos</h2>
            </header>
            <ul className="divide-y">
              {data.items.map((it, i) => (
                <li key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-gray-500">
                      {it.quantity}× ${it.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      {it.size && ` · Talla ${it.size}`}
                    </div>
                  </div>
                  <span className="font-medium">
                    ${(it.unitPrice * it.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total</span>
              <span className="font-bold text-lg">
                ${data.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </footer>
          </section>

          <section className="bg-white rounded-lg border">
            <header className="px-5 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Pagos</h2>
            </header>
            {data.payments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500 text-center">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y">
                {data.payments.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{p.method}</div>
                      <div className="text-xs text-gray-500">
                        {p.paidAt ? `Pagado ${new Date(p.paidAt).toLocaleString('es-MX')}` : `Estado: ${p.status}`}
                      </div>
                    </div>
                    <span className={`font-medium ${p.status === 'PAID' ? 'text-green-700' : 'text-gray-600'}`}>
                      ${p.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Columna lateral: cliente, apartado, acciones */}
        <aside className="space-y-6">
          <section className="bg-white rounded-lg border p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-1">Cliente</h2>
            <p className="text-sm">{order.customer.name}</p>
            <p className="text-xs text-gray-500">{order.customer.email}</p>
            {order.customer.phone && <p className="text-xs text-gray-500">{order.customer.phone}</p>}
          </section>

          {data.layaway && (
            <section className="bg-white rounded-lg border p-5 space-y-2">
              <h2 className="font-semibold text-gray-900 mb-1">Apartado</h2>
              <p className="text-xs text-gray-500">Estado: <span className="font-medium text-gray-900">{data.layaway.status}</span></p>
              <p className="text-xs text-gray-500">Anticipo: ${data.layaway.depositAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500">Abonado: ${data.layaway.paidAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500">Resta: ${(remaining ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500">Vence: {new Date(data.layaway.dueDate).toLocaleDateString('es-MX')}</p>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (data.layaway.paidAmount / data.total) * 100)}%` }}
                />
              </div>
            </section>
          )}

          <section className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Acciones</h2>
            <OrderActions
              orderId={order.id}
              currentStatus={order.status}
              allowed={allowed}
              canRegisterCash={order.status === 'PENDING_PAYMENT'}
              isLayaway={order.type === 'LAYAWAY'}
              remaining={remaining ?? Number(order.total)}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
