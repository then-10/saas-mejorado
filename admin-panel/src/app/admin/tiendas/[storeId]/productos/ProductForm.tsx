'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export type ProductFormInitial = {
  id?: string
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  sizes: string[]
  stock: number
  isActive: boolean
}

const DEFAULT: ProductFormInitial = {
  name: '', description: '', price: 0, imageUrl: '',
  category: 'general', sizes: [], stock: 0, isActive: true,
}

export function ProductForm({
  storeId,
  initial,
  mode,
}: {
  storeId: string
  initial?: ProductFormInitial
  mode: 'create' | 'edit'
}) {
  const router = useRouter()
  const [form, setForm] = useState<ProductFormInitial>(initial ?? DEFAULT)
  const [sizesInput, setSizesInput] = useState((initial?.sizes ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function update<K extends keyof ProductFormInitial>(k: K, v: ProductFormInitial[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  async function submit() {
    if (!form.name.trim()) { setErr('El nombre es obligatorio'); return }
    if (!(form.price > 0)) { setErr('El precio debe ser mayor a 0'); return }
    if (form.stock < 0 || !Number.isInteger(form.stock)) { setErr('El stock debe ser un entero ≥ 0'); return }

    setBusy(true); setErr(null)
    try {
      const sizes = sizesInput.split(',').map((s) => s.trim()).filter(Boolean)
      const body = { ...form, sizes, ...(mode === 'create' ? { storeId } : {}) }
      const url = mode === 'create'
        ? '/api/admin/shop/products'
        : `/api/admin/shop/products/${form.id}`
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.push(`/admin/tiendas/${storeId}/productos`)
      router.refresh()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function softDelete() {
    if (!form.id) return
    if (!confirm('Desactivar el producto? Quedará oculto pero su historial se conserva.')) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/shop/products/${form.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.push(`/admin/tiendas/${storeId}/productos`)
      router.refresh()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-5 max-w-2xl">
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
      )}

      <Field label="Nombre" required>
        <input
          type="text" value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={busy}
        />
      </Field>

      <Field label="Descripción">
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={busy}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio (MXN)" required>
          <input
            type="number" step="0.01" min="0.01"
            value={form.price || ''}
            onChange={(e) => update('price', parseFloat(e.target.value) || 0)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={busy}
          />
        </Field>
        <Field label="Stock">
          <input
            type="number" step="1" min="0"
            value={form.stock}
            onChange={(e) => update('stock', parseInt(e.target.value) || 0)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={busy}
          />
        </Field>
      </div>

      <Field label="URL de la imagen">
        <input
          type="url" value={form.imageUrl}
          onChange={(e) => update('imageUrl', e.target.value)}
          placeholder="https://…"
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={busy}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoría">
          <input
            type="text" value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={busy}
          />
        </Field>
        <Field label="Tallas (separadas por coma)">
          <input
            type="text" value={sizesInput}
            onChange={(e) => setSizesInput(e.target.value)}
            placeholder="S, M, L, XL"
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={busy}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
          disabled={busy}
        />
        Producto activo (visible en la app)
      </label>

      <div className="flex items-center gap-3 pt-2 border-t">
        <button
          onClick={submit}
          disabled={busy}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Guardando…' : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
        </button>
        <Link
          href={`/admin/tiendas/${storeId}/productos`}
          className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2"
        >Cancelar</Link>
        {mode === 'edit' && (
          <button
            onClick={softDelete}
            disabled={busy}
            className="ml-auto text-sm text-red-700 hover:text-red-900 px-4 py-2"
          >Desactivar (soft delete)</button>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700 mb-1 block">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  )
}
