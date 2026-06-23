import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { FEATURES, PLAN_LABELS, BUSINESS_TYPE_LABELS, PLAN_PRICES } from '@/lib/features'
import Link from 'next/link'
import FeatureToggles from '@/components/FeatureToggles'
import ChangePlanModal from '@/components/ChangePlanModal'
import StoreAddOnCard from '@/components/StoreAddOnCard'

async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      features: true,
      config: true,
      store: { select: { id: true, apiKey: true, monthlyPrice: true, isActive: true } },
    },
  })
}

async function getActivityLogs(clientId: string) {
  return prisma.activityLog.findMany({
    where: { entityId: clientId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { admin: { select: { name: true } } },
  })
}

const planBadge = {
  BASICO: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

const statusBadge = {
  ACTIVO: 'bg-green-100 text-green-700',
  SUSPENDIDO: 'bg-red-100 text-red-700',
  PRUEBA: 'bg-yellow-100 text-yellow-700',
}

const statusLabel = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  PRUEBA: 'Prueba',
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const [client, activityLogs] = await Promise.all([
    getClient(params.id),
    getActivityLogs(params.id),
  ])
  if (!client) notFound()

  const featureMap = Object.fromEntries(client.features.map((f) => [f.featureKey, f]))
  const configMap = (client.config?.config ?? {}) as Record<string, Record<string, string>>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/clientes" className="hover:text-indigo-600">Clientes</Link>
            <span>/</span>
            <span className="text-gray-900">{client.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        </div>
        <Link
          href={`/admin/clientes/${client.id}/editar`}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="lg:col-span-1 space-y-5">
          {/* Client Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">
                  {client.businessType === 'RESTAURANTE' ? '🍽️' : client.businessType === 'TIENDA_ROPA' ? '👗' : client.businessType === 'CAFETERIA' ? '☕' : '🏪'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{client.name}</p>
                <p className="text-sm text-gray-500">{BUSINESS_TYPE_LABELS[client.businessType] || client.businessType}</p>
              </div>
            </div>

            <div className="space-y-3">
              <InfoRow label="Email" value={client.email} />
              <InfoRow label="Teléfono" value={client.phone || '—'} />
              <InfoRow label="Contacto" value={client.contactName || '—'} />
              <InfoRow label="Ciudad" value={client.city || '—'} />
              <InfoRow label="Dirección" value={client.address || '—'} />
              {client.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notas</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{client.notes}</p>
                </div>
              )}
              <InfoRow
                label="Registro"
                value={new Date(client.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
              />
            </div>
          </div>

          {/* Plan Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Plan Actual</h3>
              <ChangePlanModal clientId={client.id} currentPlan={client.plan} />
            </div>
            <div className="text-center py-3">
              <span className={`text-sm font-semibold px-4 py-2 rounded-full ${planBadge[client.plan as keyof typeof planBadge] || 'bg-gray-100'}`}>
                {PLAN_LABELS[client.plan] || client.plan}
              </span>
              <p className="text-3xl font-bold text-gray-900 mt-3">${PLAN_PRICES[client.plan]}</p>
              <p className="text-sm text-gray-500">USD/mes</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">Estado</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[client.status as keyof typeof statusBadge] || 'bg-gray-100'}`}>
                {statusLabel[client.status as keyof typeof statusLabel] || client.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-500">Leads/mes</span>
              <span className="text-sm font-medium text-gray-900">{client.monthlyLeads}</span>
            </div>
          </div>

          <StoreAddOnCard
            clientId={client.id}
            clientName={client.name}
            clientEmail={client.email}
            store={
              client.store
                ? {
                    id: client.store.id,
                    apiKey: client.store.apiKey,
                    monthlyPrice: Number(client.store.monthlyPrice),
                    isActive: client.store.isActive,
                  }
                : null
            }
          />
        </div>

        {/* Right: Features + Activity */}
        <div className="lg:col-span-2 space-y-5">
          {/* Features */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Herramientas y Funcionalidades</h3>
            <FeatureToggles
              clientId={client.id}
              features={Object.values(FEATURES)}
              featureMap={featureMap}
              configMap={configMap}
            />
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Historial de Actividad</h3>
            {activityLogs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sin actividad registrada</p>
            ) : (
              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-700">{log.action}</p>
                      {log.details && <p className="text-gray-400 text-xs mt-0.5">{log.details}</p>}
                      <p className="text-gray-400 text-xs mt-0.5">
                        {log.admin?.name || 'Sistema'} —{' '}
                        {new Date(log.createdAt).toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  )
}
