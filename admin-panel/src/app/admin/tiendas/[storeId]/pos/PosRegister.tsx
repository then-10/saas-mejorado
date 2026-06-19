'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PosProduct {
  id: string
  name: string
  price: number
  stock: number
  sizes: string[]
  category: string
}

interface CartLine {
  productId: string
  name: string
  price: number
  size: string
  quantity: number
}

export function PosRegister({ storeId, products }: { storeId: string; products: PosProduct[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [search, products])

  function addToCart(p: PosProduct) {
    const size = p.sizes[0] ?? ''
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id && l.size === size)
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id && l.size === size ? { ...l, quantity: Math.min(p.stock, l.quantity + 1) } : l
        )
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, size, quantity: 1 }]
    })
  }

  function updateQty(productId: string, size: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId && l.size === size ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  function removeLine(productId: string, size: string) {
    setCart((prev) => prev.filter((l) => !(l.productId === productId && l.size === size)))
  }

  const total = cart.reduce((acc, l) => acc + l.price * l.quantity, 0)

  async function checkout() {
    if (cart.length === 0) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/shop/orders/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, size: l.size })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'No se pudo registrar la venta' })
        setLoading(false)
        return
      }
      setMessage({ type: 'ok', text: 'Venta registrada' })
      setCart([])
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="text-left border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:shadow-sm transition"
            >
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.name}</p>
              <p className="text-xs text-gray-500 mt-1">${p.price.toFixed(2)} · stock {p.stock}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-gray-400 text-center py-8">Sin productos disponibles</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Venta actual</h3>
        <div className="flex-1 space-y-2 mb-4 max-h-[360px] overflow-y-auto">
          {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Carrito vacío</p>}
          {cart.map((l) => (
            <div key={`${l.productId}-${l.size}`} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex-1">
                <p className="text-gray-900">{l.name}</p>
                <p className="text-xs text-gray-500">${l.price.toFixed(2)} c/u</p>
              </div>
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => updateQty(l.productId, l.size, Number(e.target.value))}
                className="w-14 px-1.5 py-1 border border-gray-300 rounded text-center"
              />
              <button onClick={() => removeLine(l.productId, l.size)} className="text-gray-400 hover:text-red-600 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
          {message && (
            <p className={`text-xs mb-2 ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
          <button
            onClick={checkout}
            disabled={loading || cart.length === 0}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium"
          >
            {loading ? 'Procesando...' : 'Cobrar en efectivo'}
          </button>
        </div>
      </div>
    </div>
  )
}
