import { prisma } from '@/lib/prisma'
import { PLAN_PRICES, PLAN_LABELS, BUSINESS_TYPE_LABELS } from '@/lib/features'
import Link from 'next/link'

async function getDashboardData() {
  const [totalClients, byStatus, byPlan, byBusinessType, recentClients] =
    await Promise.all([
      prisma.client.count(),
      prisma.client.groupBy({ by: ['status'], _count: true }),
      prisma.client.groupBy({ by: ['plan'], _count: true }),
      prisma.client.groupBy({ by: ['businessType'], _count: true }),
      prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

  const activeClients = byStatus.find((s) => s.status === 'ACTIVO')?._count ?? 0
  const trialClients = byStatus.find((s) => s.status === 'PRUEBA')?._count ?? 0
  const suspendedClients = byStatus.find((s) => s.status === 'SUSPENDIDO')?._count ?? 0

  let revenue = 0
  for (const group of byPlan) {
    if (group.plan === 'ACTIVO' as never) continue
    revenue += (PLAN_PRICES[group.plan] ?? 0) * group._count
  }

  // Revenue from active clients only
  const activeByPlan = await prisma.client.groupBy({
    by: ['plan'],
    where: { status: 'ACTIVO' },
    _count: true,
  })
  let activeRevenue = 0
  for (const g of activeByPlan) {
    activeRevenue += (PLAN_PRICES[g.plan] ?? 0) * g._count
  }

  return {
    totalClients,
    activeClients,
    trialClients,
    suspendedClients,
    activeRevenue,
    byPlan,
    byBusinessType,
    recentClients,
  }
}

const statusBadge = {
  ACTIVO: 'bg-green-100 text-green-700',
  SUSPENDIDO: 'bg-red-100 text-red-700',
  PRUEBA: 'bg-yellow-100 text-yellow-700',
}

const planBadge = {
  BASICO: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del panel de administración</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Clientes"
          value={data.totalClients}
          icon="👥"
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Clientes Activos"
          value={data.activeClients}
          icon="✅"
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="En Prueba"
          value={data.trialClients}
          icon="🕐"
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Suspendidos"
          value={data.suspendedClients}
          icon="🚫"
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Revenue */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Ingresos Mensuales Estimados</p>
            <p className="text-4xl font-bold mt-1">${data.activeRevenue.toLocaleString()}</p>
            <p className="text-indigo-200 text-sm mt-1">USD/mes (clientes activos)</p>
          </div>
          <div className="text-6xl opacity-20">💰</div>
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Plan */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribución por Plan</h3>
          <div className="space-y-3">
            {data.byPlan.map((item) => (
              <div key={item.plan} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${planBadge[item.plan as keyof typeof planBadge] || 'bg-gray-100 text-gray-600'}`}>
                    {PLAN_LABELS[item.plan] || item.plan}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${data.totalClients ? (item._count / data.totalClients) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-6 text-right">{item._count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Business Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Por Tipo de Negocio</h3>
          <div className="space-y-3">
            {data.byBusinessType.map((item) => (
              <div key={item.businessType} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${data.totalClients ? (item._count / data.totalClients) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-6 text-right">{item._count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Clients */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Clientes Recientes</h3>
          <Link href="/admin/clientes" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Negocio</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/admin/clientes/${client.id}`} className="font-medium text-sm text-gray-900 hover:text-indigo-600">
                      {client.name}
                    </Link>
                    <p className="text-xs text-gray-500">{client.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {BUSINESS_TYPE_LABELS[client.businessType] || client.businessType}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${planBadge[client.plan as keyof typeof planBadge] || 'bg-gray-100'}`}>
                      {PLAN_LABELS[client.plan] || client.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[client.status as keyof typeof statusBadge] || 'bg-gray-100'}`}>
                      {client.status === 'ACTIVO' ? 'Activo' : client.status === 'SUSPENDIDO' ? 'Suspendido' : 'Prueba'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{client.city || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-2xl p-2 rounded-lg ${color}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
