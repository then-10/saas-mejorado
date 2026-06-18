'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ProductActiveToggle({
  productId, isActive,
}: { productId: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState(isActive)
  const [err, setErr] = useState<string | null>(null)

  async function toggle() {
    const next = !optimistic
    if (!next && !confirm('Desactivar el producto? Quedará oculto en la app pero su historial se conserva.')) return

    setErr(null)
    setOptimistic(next)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/shop/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: next }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        router.refresh()
      } catch (e) {
        setOptimistic(!next)
        setErr((e as Error).message)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          optimistic ? 'bg-green-500' : 'bg-gray-300'
        } disabled:opacity-50`}
        aria-label={optimistic ? 'Desactivar producto' : 'Activar producto'}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            optimistic ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-xs text-gray-600">{optimistic ? 'Activo' : 'Inactivo'}</span>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  )
}
