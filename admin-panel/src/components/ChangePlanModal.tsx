'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLAN_LABELS, PLAN_PRICES } from '@/lib/features'

const plans = ['BASICO', 'PROFESIONAL', 'ENTERPRISE'] as const

export default function ChangePlanModal({
  clientId,
  currentPlan,
}: {
  clientId: string
  currentPlan: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentPlan)
  const [loading, setLoading] = useState(false)

  async function handleChange() {
    if (selected === currentPlan) { setOpen(false); return }
    setLoading(true)
    await fetch(`/api/admin/clientes/${clientId}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selected }),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
      >
        Cambiar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Plan</h3>
            <div className="space-y-2 mb-5">
              {plans.map((plan) => (
                <button
                  key={plan}
                  onClick={() => setSelected(plan)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    selected === plan ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-sm">{PLAN_LABELS[plan]}</span>
                  <span className="text-sm text-gray-500">${PLAN_PRICES[plan]}/mes</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Al cambiar el plan, las funcionalidades se actualizarán automáticamente según el nuevo plan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleChange}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
              >
                {loading ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
