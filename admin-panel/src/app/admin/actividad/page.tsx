import { prisma } from '@/lib/prisma'

async function getActivity() {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      admin: { select: { name: true } },
      client: { select: { name: true } },
    },
  })
}

export default async function ActividadPage() {
  const logs = await getActivity()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Actividad</h1>
        <p className="text-gray-500 text-sm mt-1">Historial de todas las acciones del panel</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {logs.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No hay actividad registrada
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="px-6 py-4 flex items-start gap-4">
            <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 shrink-0" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  {log.details && (
                    <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {log.admin?.name || 'Sistema'}
                    {log.client?.name && ` — ${log.client.name}`}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString('es-MX')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
