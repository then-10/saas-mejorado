'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  PREPARING: 'Marcar como preparando',
  READY_FOR_PICKUP: 'Marcar como listo para recoger',
  SHIPPED: 'Marcar como enviado',
  DELIVERED: 'Marcar como entregado',
  CANCELLED: 'Cancelar pedido',
  EXPIRED: 'Marcar como vencido',
}

export function OrderActions({
  orderId,
  currentStatus,
  allowed,
  canRegisterCash,
  isLayaway,
  remaining,
}: {
  orderId: string
  currentStatus: string
  allowed: string[]
  canRegisterCash: boolean
  isLayaway: boolean
  remaining: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [amount, setAmount] = useState(remaining.toFixed(2))

  async function changeStatus(next: string) {
    if (!confirm(`Cambiar estado a "${STATUS_LABEL[next] ?? next}"?`)) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function registerCash() {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Monto inválido'); return }
    if (!confirm(isLayaway
      ? `Registrar abono en efectivo de $${amt.toFixed(2)} al apartado?`
      : `Registrar pago en efectivo de $${amt.toFixed(2)}?`)) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/payments/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      {err && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
      )}

      {/* Pago en efectivo */}
      {canRegisterCash && (
        <div className="border rounded p-3 bg-gray-50 space-y-2">
          <label className="text-xs font-medium text-gray-700">
            {isLayaway ? 'Abono en efectivo' : 'Pago en efectivo'}
          </label>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" min="0.01" max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 text-sm border rounded px-2 py-1"
              disabled={busy}
            />
            <button
              onClick={registerCash}
              disabled={busy}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Registrar
            </button>
          </div>
          <p className="text-xs text-gray-500">Resta: ${remaining.toFixed(2)}</p>
        </div>
      )}

      {/* Transiciones de estado */}
      {allowed.length === 0 ? (
        <p className="text-xs text-gray-500">No hay transiciones disponibles desde <span className="font-medium">{currentStatus}</span>.</p>
      ) : (
        <div className="space-y-2">
          {allowed.map((next) => (
            <button
              key={next}
              onClick={() => changeStatus(next)}
              disabled={busy}
              className={`w-full text-sm px-3 py-2 rounded border ${
                next === 'CANCELLED' || next === 'EXPIRED'
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
              } disabled:opacity-50`}
            >
              {STATUS_LABEL[next] ?? next}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
