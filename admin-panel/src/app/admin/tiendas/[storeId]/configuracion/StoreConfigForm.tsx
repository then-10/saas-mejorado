'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Initial = {
  name: string
  paymentProvider: 'MERCADO_PAGO' | 'CONEKTA'
  layawayDepositPct: number
  layawayDays: number
  address: string
  hasMpKey: boolean
  hasConektaKey: boolean
  iaMarketingEnabled: boolean
  customerAppAccessEnabled: boolean
}

export function StoreConfigForm({ storeId, initial }: { storeId: string; initial: Initial }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: initial.name,
    paymentProvider: initial.paymentProvider,
    layawayDepositPct: initial.layawayDepositPct,
    layawayDays: initial.layawayDays,
    address: initial.address,
  })
  const [mpKey, setMpKey] = useState('')
  const [conektaKey, setConektaKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [iaMarketingEnabled, setIaMarketingEnabled] = useState(initial.iaMarketingEnabled)
  const [iaBusy, setIaBusy] = useState(false)
  const [customerAppAccessEnabled, setCustomerAppAccessEnabled] = useState(initial.customerAppAccessEnabled)
  const [customerAccessBusy, setCustomerAccessBusy] = useState(false)

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  async function submit() {
    setBusy(true); setMsg(null)
    try {
      const body: Record<string, unknown> = { ...form }
      // Solo enviamos las llaves cuando el admin las ingresa de nuevo
      if (mpKey.trim()) body.mpAccessToken = mpKey.trim()
      if (conektaKey.trim()) body.conektaKey = conektaKey.trim()

      const res = await fetch(`/api/admin/shop/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setMpKey(''); setConektaKey('')
      setMsg({ kind: 'ok', text: 'Configuración guardada.' })
      router.refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally { setBusy(false) }
  }

  async function toggleIaMarketing(next: boolean) {
    setIaBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/shop/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iaMarketingEnabled: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setIaMarketingEnabled(next)
      setMsg({ kind: 'ok', text: next ? 'IA Marketing activada.' : 'IA Marketing desactivada.' })
      router.refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally { setIaBusy(false) }
  }

  async function toggleCustomerAppAccess(next: boolean) {
    setCustomerAccessBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/shop/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerAppAccessEnabled: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setCustomerAppAccessEnabled(next)
      setMsg({ kind: 'ok', text: next ? 'Acceso de clientes a la app activado.' : 'Acceso de clientes a la app desactivado.' })
      router.refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally { setCustomerAccessBusy(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Datos generales */}
      <section className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Datos generales</h2>
        <Field label="Nombre comercial">
          <input
            type="text" value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" disabled={busy}
          />
        </Field>
        <Field label="Dirección">
          <textarea
            value={form.address} onChange={(e) => update('address', e.target.value)}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" disabled={busy}
          />
        </Field>
      </section>

      {/* Apartados */}
      <section className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Apartados</h2>
          <p className="text-xs text-gray-500 mt-1">
            Estos valores aplican a los nuevos apartados; los existentes mantienen sus condiciones.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Anticipo mínimo (%)" hint="Entre 10 y 100">
            <input
              type="number" min="10" max="100" step="1"
              value={form.layawayDepositPct}
              onChange={(e) => update('layawayDepositPct', parseInt(e.target.value) || 30)}
              className="w-full border rounded px-3 py-2 text-sm" disabled={busy}
            />
          </Field>
          <Field label="Plazo (días)" hint="Entre 7 y 90">
            <input
              type="number" min="7" max="90" step="1"
              value={form.layawayDays}
              onChange={(e) => update('layawayDays', parseInt(e.target.value) || 30)}
              className="w-full border rounded px-3 py-2 text-sm" disabled={busy}
            />
          </Field>
        </div>
      </section>

      {/* Pagos */}
      <section className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Proveedor de pagos</h2>
          <p className="text-xs text-gray-500 mt-1">
            Las llaves se cifran (AES-256-GCM) antes de guardar y nunca se muestran de vuelta.
            Deja los campos vacíos para conservar la llave actual.
          </p>
        </div>

        <div className="space-y-3">
          {(['MERCADO_PAGO', 'CONEKTA'] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="radio" checked={form.paymentProvider === p}
                onChange={() => update('paymentProvider', p)} disabled={busy}
              />
              {p === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Conekta'}
              <span className="text-xs text-gray-500 ml-2">
                {p === 'MERCADO_PAGO'
                  ? (initial.hasMpKey ? '✓ Llave configurada' : '✗ Sin llave')
                  : (initial.hasConektaKey ? '✓ Llave configurada' : '✗ Sin llave')}
              </span>
            </label>
          ))}
        </div>

        <Field label="Mercado Pago — Access Token" hint="Solo si quieres reemplazar la llave actual">
          <input
            type="password" autoComplete="off" placeholder="APP_USR-…"
            value={mpKey} onChange={(e) => setMpKey(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm font-mono" disabled={busy}
          />
        </Field>

        <Field label="Conekta — Private Key" hint="Solo si quieres reemplazar la llave actual">
          <input
            type="password" autoComplete="off" placeholder="key_…"
            value={conektaKey} onChange={(e) => setConektaKey(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm font-mono" disabled={busy}
          />
        </Field>
      </section>

      {/* Acceso de clientes a la app */}
      <section className="bg-white rounded-lg border p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Acceso de clientes a la app</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              Permite que tus clientes finales creen su propia cuenta (email/contraseña) e
              inicien sesión en la app de la tienda con credenciales independientes de las
              tuyas como administrador. Al desactivarlo, se bloquean los registros e inicios
              de sesión de clientes nuevos en esta tienda.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={customerAppAccessEnabled}
            onClick={() => toggleCustomerAppAccess(!customerAppAccessEnabled)}
            disabled={customerAccessBusy}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              customerAppAccessEnabled ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                customerAppAccessEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* IA Marketing */}
      <section className="bg-white rounded-lg border p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">IA Marketing</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              Genera copys con IA para redes sociales (Instagram, TikTok, Facebook) desde la app.
              Costo cubierto por el plan intermedio.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={iaMarketingEnabled}
            onClick={() => toggleIaMarketing(!iaMarketingEnabled)}
            disabled={iaBusy}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              iaMarketingEnabled ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                iaMarketingEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {msg && (
        <p className={`text-sm rounded px-3 py-2 ${
          msg.kind === 'ok'
            ? 'text-green-800 bg-green-50 border border-green-200'
            : 'text-red-800 bg-red-50 border border-red-200'
        }`}>{msg.text}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit} disabled={busy}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
        >{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </div>
  )
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700 block">{label}</span>
      {hint && <span className="text-xs text-gray-500 block mb-1">{hint}</span>}
      {children}
    </label>
  )
}
