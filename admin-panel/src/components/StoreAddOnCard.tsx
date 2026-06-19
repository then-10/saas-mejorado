'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StoreSummary {
  id: string
  apiKey: string
  monthlyPrice: number | string
}

export default function StoreAddOnCard({
  clientId,
  clientName,
  clientEmail,
  store,
}: {
  clientId: string
  clientName: string
  clientEmail: string
  store: StoreSummary | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('499')
  const [revealed, setRevealed] = useState(false)
  const [created, setCreated] = useState<{ apiKey: string; email: string; tempPassword: string } | null>(null)

  async function activate() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/shop/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, monthlyPrice: Number(monthlyPrice), ownerEmail: clientEmail }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al activar la tienda')
      return
    }
    setCreated({
      apiKey: data.store.apiKey,
      email: data.ownerCredentials.email,
      tempPassword: data.ownerCredentials.tempPassword,
    })
    router.refresh()
  }

  if (created) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">App + POS activado</h3>
        <p className="text-xs text-gray-500 mb-4">
          Guarda estas credenciales ahora — la contraseña temporal no se mostrará de nuevo.
          Configúralas en la app Android y en el POS web (<code>/tienda</code>) de {clientName}.
        </p>
        <div className="space-y-2 text-sm">
          <CredentialRow label="X-Tenant-Key" value={created.apiKey} />
          <CredentialRow label="Email dueño" value={created.email} />
          <CredentialRow label="Contraseña temporal" value={created.tempPassword} />
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">App + POS (add-on de pago mensual)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Activa el módulo e-commerce para este cliente: catálogo, pedidos, pagos y apartados.
          Habilita la app Android y el punto de venta web, administrados desde tu SaaS.
          Se factura como un cargo mensual independiente del plan.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-gray-600">Precio mensual (USD)</label>
          <input
            type="number"
            min={1}
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
            className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button
          onClick={activate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
        >
          {loading ? 'Activando...' : 'Activar App + POS'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">App + POS</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Activo</span>
      </div>
      <p className="text-sm text-gray-700 mb-1">
        ${Number(store.monthlyPrice).toFixed(2)} <span className="text-xs text-gray-500">USD/mes</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">X-Tenant-Key</span>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {revealed ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <p className="text-xs font-mono bg-gray-50 rounded px-2 py-1.5 mt-1 break-all">
        {revealed ? store.apiKey : '•'.repeat(24)}
      </p>
      <Link
        href={`/admin/tiendas/${store.id}`}
        className="mt-4 inline-block text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        Administrar pedidos, productos y apartados →
      </Link>
    </div>
  )
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50 rounded px-3 py-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs font-mono text-gray-900 break-all text-right">{value}</span>
    </div>
  )
}
