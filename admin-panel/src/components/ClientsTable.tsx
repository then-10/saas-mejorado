'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { PLAN_LABELS, BUSINESS_TYPE_LABELS } from '@/lib/features'
import type { Client } from '@prisma/client'

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

const planBadge = {
  BASICO: 'bg-blue-100 text-blue-700',
  PROFESIONAL: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

interface Props {
  clients: Client[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  searchParams: { q?: string; plan?: string; status?: string; tipo?: string; page?: string }
}

export default function ClientsTable({ clients, total, page, totalPages, searchParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [suspendConfirm, setSuspendConfirm] = useState<string | null>(null)

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams()
    if (searchParams.q) params.set('q', searchParams.q)
    if (searchParams.plan) params.set('plan', searchParams.plan)
    if (searchParams.status) params.set('status', searchParams.status)
    if (searchParams.tipo) params.set('tipo', searchParams.tipo)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  async function handleSuspend(id: string) {
    await fetch(`/api/admin/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDIDO' }),
    })
    setSuspendConfirm(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre, email, ciudad..."
            defaultValue={searchParams.q}
            onChange={(e) => updateParam('q', e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            defaultValue={searchParams.plan || ''}
            onChange={(e) => updateParam('plan', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todos los planes</option>
            <option value="BASICO">Básico</option>
            <option value="PROFESIONAL">Profesional</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
          <select
            defaultValue={searchParams.status || ''}
            onChange={(e) => updateParam('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="PRUEBA">Prueba</option>
            <option value="SUSPENDIDO">Suspendido</option>
          </select>
          <select
            defaultValue={searchParams.tipo || ''}
            onChange={(e) => updateParam('tipo', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todos los tipos</option>
            <option value="RESTAURANTE">Restaurante</option>
            <option value="TIENDA_ROPA">Tienda de Ropa</option>
            <option value="CAFETERIA">Cafetería</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Negocio</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registro</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/clientes/${client.id}`}>
                      <p className="font-medium text-sm text-gray-900 hover:text-indigo-600">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </Link>
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
                      {statusLabel[client.status as keyof typeof statusLabel] || client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{client.city || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(client.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/clientes/${client.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/admin/clientes/${client.id}/editar`}
                        className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Editar
                      </Link>
                      {client.status !== 'SUSPENDIDO' && (
                        <button
                          onClick={() => setSuspendConfirm(client.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages} — {total} resultados
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams as Record<string, string>)
                    params.set('page', String(page - 1))
                    router.push(`${pathname}?${params.toString()}`)
                  }}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Anterior
                </button>
              )}
              {page < totalPages && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams as Record<string, string>)
                    params.set('page', String(page + 1))
                    router.push(`${pathname}?${params.toString()}`)
                  }}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Siguiente
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suspend Confirm Modal */}
      {suspendConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">¿Suspender cliente?</h3>
              <p className="text-sm text-gray-500 mt-1">Esta acción cambiará el estado del cliente a suspendido. Puedes reactivarlo después.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSuspendConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSuspend(suspendConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
