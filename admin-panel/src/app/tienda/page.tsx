'use client'

import { useMemo, useState } from 'react'

const ACCENT = '#E94560'

type Payment = 'Efectivo' | 'Tarjeta' | 'Transferencia'
type OrderStatus = 'PAGADO' | 'APARTADO' | 'CANCELLED'

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  sizes: string[]
  desc: string
}

interface PaymentEntry {
  amount: number
  method: Payment
  date: string
  concept: string
}

interface Order {
  id: string
  productName: string
  client: string
  qty: number
  size: string
  total: number
  paid: number
  payment: Payment
  status: OrderStatus
  delivered: boolean
  bucket: 'today' | 'week'
  timeLabel: string
  payments: PaymentEntry[]
}

const PAYMENTS: Payment[] = ['Efectivo', 'Tarjeta', 'Transferencia']
const CATEGORIES = ['Vestidos', 'Blusas', 'Pantalones', 'Faldas', 'Accesorios']
const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL']
const PAY_ICON: Record<string, string> = { Efectivo: '💵', Tarjeta: '💳', Transferencia: '🏦' }

const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Vestido Negro Elegante', category: 'Vestidos', price: 450, stock: 12, sizes: ['S', 'M', 'L'], desc: 'Vestido negro de corte recto, ideal para ocasiones especiales.' },
  { id: 'p2', name: 'Blusa Floral Verano', category: 'Blusas', price: 220, stock: 4, sizes: ['XS', 'S', 'M'], desc: 'Blusa ligera con estampado floral.' },
  { id: 'p3', name: 'Pantalón Wide Leg', category: 'Pantalones', price: 380, stock: 8, sizes: ['S', 'M', 'L', 'XL'], desc: 'Pantalón de pierna ancha, tela fluida.' },
  { id: 'p4', name: 'Falda Plisada Midi', category: 'Faldas', price: 310, stock: 3, sizes: ['S', 'M'], desc: 'Falda midi plisada, cintura alta.' },
  { id: 'p5', name: 'Collar Dorado Boho', category: 'Accesorios', price: 95, stock: 20, sizes: [], desc: 'Collar dorado estilo boho.' },
  { id: 'p6', name: 'Blusa Satinada Negra', category: 'Blusas', price: 260, stock: 6, sizes: ['XS', 'S', 'M', 'L'], desc: 'Blusa satinada con escote en V.' },
  { id: 'p7', name: 'Vestido Floral Largo', category: 'Vestidos', price: 520, stock: 5, sizes: ['M', 'L'], desc: 'Vestido largo estampado floral.' },
  { id: 'p8', name: 'Pantalón Mom Jeans', category: 'Pantalones', price: 340, stock: 9, sizes: ['S', 'M', 'L'], desc: 'Mom jeans corte clásico.' },
]

const INITIAL_ORDERS: Order[] = [
  { id: 'o1', productName: 'Vestido Negro Elegante', client: 'María González', qty: 1, size: 'M', total: 450, paid: 450, payment: 'Tarjeta', status: 'PAGADO', delivered: true, bucket: 'today', timeLabel: '10:30 am', payments: [{ amount: 450, method: 'Tarjeta', date: '10:30 am', concept: 'Pago completo' }] },
  { id: 'o2', productName: 'Blusa Floral Verano', client: 'Laura Pérez', qty: 2, size: 'S', total: 440, paid: 200, payment: 'Efectivo', status: 'APARTADO', delivered: false, bucket: 'today', timeLabel: '11:15 am', payments: [{ amount: 200, method: 'Efectivo', date: '11:15 am', concept: 'Anticipo' }] },
  { id: 'o3', productName: 'Pantalón Wide Leg', client: 'Carla Ruiz', qty: 1, size: 'L', total: 380, paid: 380, payment: 'Transferencia', status: 'PAGADO', delivered: false, bucket: 'today', timeLabel: '12:40 pm', payments: [{ amount: 380, method: 'Transferencia', date: '12:40 pm', concept: 'Pago completo' }] },
  { id: 'o4', productName: 'Collar Dorado Boho', client: 'María González', qty: 1, size: '', total: 95, paid: 95, payment: 'Efectivo', status: 'PAGADO', delivered: true, bucket: 'week', timeLabel: 'Lun · 09:10 am', payments: [{ amount: 95, method: 'Efectivo', date: 'Lun · 09:10 am', concept: 'Pago completo' }] },
  { id: 'o5', productName: 'Falda Plisada Midi', client: 'Daniela Soto', qty: 1, size: 'S', total: 310, paid: 100, payment: 'Efectivo', status: 'APARTADO', delivered: false, bucket: 'week', timeLabel: 'Mar · 03:20 pm', payments: [{ amount: 100, method: 'Efectivo', date: 'Mar · 03:20 pm', concept: 'Anticipo' }] },
  { id: 'o6', productName: 'Vestido Floral Largo', client: 'Laura Pérez', qty: 1, size: 'M', total: 520, paid: 0, payment: 'Tarjeta', status: 'CANCELLED', delivered: false, bucket: 'week', timeLabel: 'Mié · 05:00 pm', payments: [] },
  { id: 'o7', productName: 'Blusa Satinada Negra', client: 'Daniela Soto', qty: 1, size: 'M', total: 260, paid: 260, payment: 'Tarjeta', status: 'PAGADO', delivered: true, bucket: 'week', timeLabel: 'Jue · 01:00 pm', payments: [{ amount: 260, method: 'Tarjeta', date: 'Jue · 01:00 pm', concept: 'Pago completo' }] },
]

const MK_COPIES = [
  { platform: 'Instagram', icon: '📸', hook: 'Tu look de noche empieza aquí ✨', body: 'Este vestido negro es ese básico que nunca falla: cae perfecto, estiliza y combina con todo. 🖤 Tallas S a L disponibles… pero vuelan rápido. Pásate hoy o escríbenos por DM 💬', tags: '#ModaMujer #VestidoNegro #OOTD #TiendaRopa #LookDeNoche' },
  { platform: 'TikTok', icon: '🎵', hook: 'POV: encontraste EL vestido 🔥', body: 'Negro, elegante y a un precio que no esperabas 😱 Guárdalo antes de que se acabe tu talla. Apártalo desde el link en bio 🛍️✨', tags: '#fyp #parati #moda #outfitinspo #vestidonegro' },
  { platform: 'Facebook', icon: '👥', hook: 'Elegancia atemporal para cualquier ocasión', body: 'Presentamos el Vestido Negro Elegante: confección de calidad, corte favorecedor y la versatilidad que tu clóset necesita. Ideal para una cena o una salida especial. Visítanos y pruébatelo sin compromiso 🛍️', tags: '#TiendaRopa #ModaMexicana #NuevaColección' },
]

const STAT_STYLE: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  PAGADO: { bg: '#D7F3DD', fg: '#0f6b2e', label: 'Pagado' },
  APARTADO: { bg: '#FCEFC7', fg: '#7a5a00', label: 'Apartado' },
  CANCELLED: { bg: '#FFDAD6', fg: '#8c0009', label: 'Cancelado' },
}

function fmt(n: number) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0 })
}

type Tab = 'ventas' | 'productos' | 'publicaciones' | 'clientes'

export default function TiendaRopaPage() {
  const [tab, setTab] = useState<Tab>('ventas')
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [ventasView, setVentasView] = useState<'seguimiento' | 'completados'>('seguimiento')
  const [expandedOrderHistory, setExpandedOrderHistory] = useState<string | null>(null)

  // new sale dialog
  const [saleOpen, setSaleOpen] = useState(false)
  const [saleProductId, setSaleProductId] = useState<string | null>(null)
  const [saleSize, setSaleSize] = useState('')
  const [saleQty, setSaleQty] = useState(1)
  const [saleClient, setSaleClient] = useState('')
  const [salePayment, setSalePayment] = useState<Payment>('Efectivo')
  const [saleStatus, setSaleStatus] = useState<OrderStatus>('PAGADO')

  // product form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [formId, setFormId] = useState<string | null>(null)
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState('')
  const [fStock, setFStock] = useState('')
  const [fCat, setFCat] = useState(CATEGORIES[0])
  const [fDesc, setFDesc] = useState('')
  const [fSizes, setFSizes] = useState<string[]>([])

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // abono dialog
  const [abonoOpen, setAbonoOpen] = useState(false)
  const [abonoOrderId, setAbonoOrderId] = useState<string | null>(null)
  const [abonoClient, setAbonoClient] = useState('')
  const [abonoAmount, setAbonoAmount] = useState('')

  // marketing
  const [mkStep, setMkStep] = useState<'idle' | 'image' | 'loading' | 'done'>('idle')
  const [mkSettingsOpen, setMkSettingsOpen] = useState(false)
  const [mkIg, setMkIg] = useState('@mitienda')
  const [mkTk, setMkTk] = useState('@mitienda_ropa')
  const [mkFb, setMkFb] = useState('Mi Tienda Online')
  const [mkPreviewId, setMkPreviewId] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function openNewSale() {
    setSaleProductId(null)
    setSaleSize('')
    setSaleQty(1)
    setSaleClient('')
    setSalePayment('Efectivo')
    setSaleStatus('PAGADO')
    setSaleOpen(true)
  }

  function confirmSale() {
    const p = products.find((x) => x.id === saleProductId)
    if (!p || !saleClient.trim()) return
    const total = p.price * saleQty
    const timeLabel = 'Hoy · Ahora'
    const newOrder: Order = {
      id: 'o' + Date.now(),
      productName: p.name,
      client: saleClient.trim(),
      qty: saleQty,
      size: saleSize,
      total,
      paid: saleStatus === 'PAGADO' ? total : 0,
      payment: salePayment,
      status: saleStatus,
      delivered: false,
      bucket: 'today',
      timeLabel,
      payments: saleStatus === 'PAGADO' ? [{ amount: total, method: salePayment, date: timeLabel, concept: 'Pago completo' }] : [],
    }
    setOrders((prev) => [newOrder, ...prev])
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: Math.max(0, x.stock - saleQty) } : x)))
    setSaleOpen(false)
    showToast('Venta registrada')
  }

  function openForm(id: string | null) {
    if (id) {
      const p = products.find((x) => x.id === id)
      if (!p) return
      setFormId(id)
      setFName(p.name)
      setFPrice(String(p.price))
      setFStock(String(p.stock))
      setFCat(p.category)
      setFDesc(p.desc)
      setFSizes(p.sizes)
    } else {
      setFormId(null)
      setFName('')
      setFPrice('')
      setFStock('')
      setFCat(CATEGORIES[0])
      setFDesc('')
      setFSizes([])
    }
    setFormOpen(true)
  }

  function saveProduct() {
    const price = parseFloat(fPrice)
    if (!fName.trim() || isNaN(price)) return
    const stock = parseInt(fStock || '0', 10)
    if (formId) {
      setProducts((prev) => prev.map((p) => (p.id === formId ? { ...p, name: fName.trim(), price, stock, category: fCat, desc: fDesc, sizes: fSizes } : p)))
      showToast('Producto actualizado')
    } else {
      setProducts((prev) => [{ id: 'p' + Date.now(), name: fName.trim(), price, stock, category: fCat, desc: fDesc, sizes: fSizes }, ...prev])
      showToast('Producto creado')
    }
    setFormOpen(false)
  }

  function confirmDelete() {
    if (!deleteId) return
    setProducts((prev) => prev.filter((p) => p.id !== deleteId))
    setDeleteId(null)
    showToast('Producto eliminado')
  }

  function cycleStatus(orderId: string) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const next: OrderStatus = o.status === 'APARTADO' ? 'PAGADO' : o.status === 'PAGADO' ? 'CANCELLED' : 'APARTADO'
        return { ...o, status: next, paid: next === 'PAGADO' ? o.total : o.paid }
      })
    )
  }

  function toggleDelivery(orderId: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, delivered: !o.delivered } : o)))
  }

  function openAbono(client: string, orderId: string | null) {
    setAbonoClient(client)
    setAbonoOrderId(orderId)
    setAbonoAmount('')
    setAbonoOpen(true)
  }

  const abonoSaldo = useMemo(() => {
    if (abonoOrderId) {
      const o = orders.find((x) => x.id === abonoOrderId)
      return o ? o.total - o.paid : 0
    }
    return orders
      .filter((o) => o.client === abonoClient && o.status === 'APARTADO')
      .reduce((a, o) => a + (o.total - o.paid), 0)
  }, [abonoOrderId, abonoClient, orders])

  function applyAbono() {
    const amt = parseFloat(abonoAmount)
    if (isNaN(amt) || amt <= 0) return
    const now = new Date()
    const timeLabel = 'Hoy · ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')
    if (abonoOrderId) {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== abonoOrderId) return o
          const paid = Math.min(o.total, o.paid + amt)
          const entry: PaymentEntry = { amount: amt, method: 'Efectivo', date: timeLabel, concept: paid >= o.total ? 'Liquidación' : 'Abono' }
          return { ...o, paid, status: paid >= o.total ? 'PAGADO' : o.status, payments: [...o.payments, entry] }
        })
      )
    } else {
      let remaining = amt
      setOrders((prev) =>
        prev.map((o) => {
          if (o.client !== abonoClient || o.status !== 'APARTADO' || remaining <= 0) return o
          const saldo = o.total - o.paid
          const applied = Math.min(saldo, remaining)
          remaining -= applied
          const paid = o.paid + applied
          const entry: PaymentEntry = { amount: applied, method: 'Efectivo', date: timeLabel, concept: paid >= o.total ? 'Liquidación' : 'Abono' }
          return { ...o, paid, status: paid >= o.total ? 'PAGADO' : o.status, payments: [...o.payments, entry] }
        })
      )
    }
    setAbonoOpen(false)
    showToast('Abono registrado')
  }

  function generateCopies() {
    setMkStep('loading')
    setTimeout(() => setMkStep('done'), 1700)
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [search, products])

  const lowCount = products.filter((p) => p.stock <= 5).length

  const ordersVm = orders.map((o) => ({
    ...o,
    ...STAT_STYLE[o.status],
    saldo: o.total - o.paid,
    historyOpen: expandedOrderHistory === o.id,
    onToggleHistory: () => setExpandedOrderHistory((prev) => (prev === o.id ? null : o.id)),
  }))

  const isSeg = (o: Order) => !(o.status === 'PAGADO' && o.delivered)
  const seguimientoVm = ordersVm.filter((o) => isSeg(o))
  const completadosVm = ordersVm.filter((o) => !isSeg(o))

  const todayRevenue = fmt(orders.filter((o) => o.bucket === 'today' && o.status === 'PAGADO').reduce((a, o) => a + o.total, 0))
  const todayCount = orders.filter((o) => o.bucket === 'today').length
  const weekRevenue = fmt(orders.filter((o) => o.status === 'PAGADO').reduce((a, o) => a + o.total, 0))

  const clientGroups = useMemo(() => {
    const groups: Record<string, typeof ordersVm> = {}
    ordersVm.forEach((o) => {
      groups[o.client] = groups[o.client] || []
      groups[o.client].push(o)
    })
    return Object.keys(groups)
      .map((name) => {
        const list = groups[name]
        const pending = list.filter((o) => o.status === 'APARTADO').reduce((a, o) => a + o.saldo, 0)
        const spent = list.filter((o) => o.status !== 'CANCELLED').reduce((a, o) => a + o.total, 0)
        const toDeliver = list.filter((o) => o.status !== 'CANCELLED' && !o.delivered).length
        return { name, list, pending, spent, toDeliver }
      })
      .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name))
  }, [ordersVm])

  const totalPending = ordersVm.filter((o) => o.status === 'APARTADO').reduce((a, o) => a + o.saldo, 0)

  const saleProduct = products.find((p) => p.id === saleProductId) || null
  const saleTotal = fmt(saleProduct ? saleProduct.price * saleQty : 0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-8">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        {/* App bar */}
        <div className="px-5 pt-5 pb-4" style={{ backgroundColor: '#1A1A2E' }}>
          <h1 className="text-white text-lg font-semibold">
            {tab === 'ventas' && 'Ventas'}
            {tab === 'productos' && 'Productos'}
            {tab === 'publicaciones' && 'Publicaciones IA'}
            {tab === 'clientes' && 'Clientes'}
          </h1>
        </div>

        <div className="h-[600px] overflow-y-auto p-4 space-y-3">
          {tab === 'ventas' && (
            <VentasTab
              ordersVm={ventasView === 'seguimiento' ? seguimientoVm : completadosVm}
              seguimientoCount={seguimientoVm.length}
              completadosCount={completadosVm.length}
              ventasView={ventasView}
              setVentasView={(v) => { setVentasView(v); setExpandedOrderHistory(null) }}
              todayRevenue={todayRevenue}
              todayCount={todayCount}
              weekRevenue={weekRevenue}
              onNewSale={openNewSale}
              onCycle={cycleStatus}
              onToggleDelivery={toggleDelivery}
              onAbonar={(client, id) => openAbono(client, id)}
            />
          )}
          {tab === 'productos' && (
            <ProductosTab
              products={filteredProducts}
              search={search}
              setSearch={setSearch}
              lowCount={lowCount}
              onNew={() => openForm(null)}
              onEdit={(id) => openForm(id)}
              onDelete={(id) => setDeleteId(id)}
            />
          )}
          {tab === 'publicaciones' && (
            <PublicacionesTab
              mkStep={mkStep}
              setMkStep={setMkStep}
              onGenerate={generateCopies}
              onCopy={showToast}
              onOpenSettings={() => setMkSettingsOpen(true)}
              mkPreviewId={mkPreviewId}
              setMkPreviewId={setMkPreviewId}
              mkIg={mkIg}
              mkTk={mkTk}
              mkFb={mkFb}
            />
          )}
          {tab === 'clientes' && (
            <ClientesTab
              groups={clientGroups}
              expandedClient={expandedClient}
              setExpandedClient={setExpandedClient}
              totalPending={totalPending}
              onAbonarCuenta={(name) => openAbono(name, null)}
            />
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex border-t border-gray-200 bg-white">
          {([
            ['ventas', '💰', 'Ventas'],
            ['productos', '👗', 'Productos'],
            ['publicaciones', '🤖', 'IA'],
            ['clientes', '👥', 'Clientes'],
          ] as [Tab, string, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
              style={{ color: tab === t ? '#5b0010' : '#6b6b78' }}
            >
              <span className="text-base">{icon}</span>
              <span className="text-xs" style={{ fontWeight: tab === t ? 600 : 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}

      {saleOpen && (
        <SaleDialog
          products={products}
          saleProductId={saleProductId}
          setSaleProductId={setSaleProductId}
          saleSize={saleSize}
          setSaleSize={setSaleSize}
          saleQty={saleQty}
          setSaleQty={setSaleQty}
          saleClient={saleClient}
          setSaleClient={setSaleClient}
          salePayment={salePayment}
          setSalePayment={setSalePayment}
          saleStatus={saleStatus}
          setSaleStatus={setSaleStatus}
          saleProduct={saleProduct}
          saleTotal={saleTotal}
          onClose={() => setSaleOpen(false)}
          onConfirm={confirmSale}
        />
      )}

      {formOpen && (
        <ProductFormDialog
          formId={formId}
          fName={fName}
          setFName={setFName}
          fPrice={fPrice}
          setFPrice={setFPrice}
          fStock={fStock}
          setFStock={setFStock}
          fCat={fCat}
          setFCat={setFCat}
          fDesc={fDesc}
          setFDesc={setFDesc}
          fSizes={fSizes}
          setFSizes={setFSizes}
          onClose={() => setFormOpen(false)}
          onSave={saveProduct}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          message={`¿Eliminar "${products.find((p) => p.id === deleteId)?.name}"? Esta acción no se puede deshacer.`}
          onCancel={() => setDeleteId(null)}
          onConfirm={confirmDelete}
        />
      )}

      {abonoOpen && (
        <AbonoDialog
          title={abonoOrderId ? 'Registrar abono' : 'Abono a cuenta'}
          subtitle={abonoOrderId ? orders.find((o) => o.id === abonoOrderId)?.productName || '' : `Cuenta de ${abonoClient}`}
          saldo={abonoSaldo}
          amount={abonoAmount}
          setAmount={setAbonoAmount}
          onClose={() => setAbonoOpen(false)}
          onConfirm={applyAbono}
        />
      )}

      {mkSettingsOpen && (
        <MkSettingsDialog
          mkIg={mkIg}
          setMkIg={setMkIg}
          mkTk={mkTk}
          setMkTk={setMkTk}
          mkFb={mkFb}
          setMkFb={setMkFb}
          onClose={() => setMkSettingsOpen(false)}
          onSave={() => { setMkSettingsOpen(false); showToast('Configuración guardada ✓') }}
        />
      )}
    </div>
  )
}

function VentasTab({
  ordersVm, seguimientoCount, completadosCount, ventasView, setVentasView,
  todayRevenue, todayCount, weekRevenue, onNewSale, onCycle, onToggleDelivery, onAbonar,
}: {
  ordersVm: (Order & { bg: string; fg: string; label: string; saldo: number; historyOpen: boolean; onToggleHistory: () => void })[]
  seguimientoCount: number
  completadosCount: number
  ventasView: 'seguimiento' | 'completados'
  setVentasView: (v: 'seguimiento' | 'completados') => void
  todayRevenue: string
  todayCount: number
  weekRevenue: string
  onNewSale: () => void
  onCycle: (id: string) => void
  onToggleDelivery: (id: string) => void
  onAbonar: (client: string, id: string | null) => void
}) {
  const isSeguimiento = ventasView === 'seguimiento'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ backgroundColor: '#FFEFEF' }}>
          <p className="text-xs text-gray-500">Hoy ({todayCount})</p>
          <p className="text-lg font-bold" style={{ color: ACCENT }}>{todayRevenue}</p>
        </div>
        <div className="rounded-xl p-3 bg-gray-50">
          <p className="text-xs text-gray-500">Esta semana</p>
          <p className="text-lg font-bold text-gray-900">{weekRevenue}</p>
        </div>
      </div>
      <button onClick={onNewSale} className="w-full rounded-xl py-2.5 text-white text-sm font-semibold" style={{ backgroundColor: ACCENT }}>
        + Nueva venta
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => setVentasView('seguimiento')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: isSeguimiento ? ACCENT : '#F0EEF2', color: isSeguimiento ? '#fff' : 'rgba(26,26,46,.55)' }}
        >
          En seguimiento {seguimientoCount > 0 && `(${seguimientoCount})`}
        </button>
        <button
          onClick={() => setVentasView('completados')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: !isSeguimiento ? '#1A1A2E' : '#F0EEF2', color: !isSeguimiento ? '#fff' : 'rgba(26,26,46,.55)' }}
        >
          Completados {completadosCount > 0 && `(${completadosCount})`}
        </button>
      </div>
      <div className="space-y-2">
        {ordersVm.map((o) => (
          <div key={o.id} className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{o.productName}</p>
                <p className="text-xs text-gray-500">{o.client} — {o.qty}x {o.size && `· Talla ${o.size}`}</p>
                <p className="text-xs text-gray-400">{o.payment} · {o.timeLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{fmt(o.total)}</p>
                <button onClick={() => onCycle(o.id)} className="text-xs font-medium px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: o.bg, color: o.fg }}>
                  {o.label}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => onToggleDelivery(o.id)} className="text-xs px-2 py-1 rounded-full border" style={{ borderColor: o.delivered ? '#D7F3DD' : '#D8D5DD', color: o.delivered ? '#0f6b2e' : '#8a8794' }}>
                {o.delivered ? 'Entregado' : 'Por entregar'}
              </button>
              {o.status === 'APARTADO' && (
                <button onClick={() => onAbonar(o.client, o.id)} className="text-xs font-medium" style={{ color: ACCENT }}>
                  Abonar (saldo {fmt(o.saldo)})
                </button>
              )}
            </div>
            {o.payments.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <button onClick={o.onToggleHistory} className="text-xs text-gray-400 flex items-center gap-1">
                  📋 {o.payments.length} pago(s) · {fmt(o.payments[o.payments.length - 1].amount)}
                  <span className="transition-transform" style={{ transform: o.historyOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                </button>
                {o.historyOpen && (
                  <div className="mt-2 space-y-1.5">
                    {o.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                        <span className="text-gray-600">{PAY_ICON[p.method] || '💰'} {p.concept} · {p.date}</span>
                        <span className="font-semibold text-gray-800">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductosTab({
  products, search, setSearch, lowCount, onNew, onEdit, onDelete,
}: {
  products: Product[]
  search: string
  setSearch: (v: string) => void
  lowCount: number
  onNew: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar producto o categoría..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
      {lowCount > 0 && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#FFF4E5', color: '#9a5b00' }}>
          ⚠ {lowCount} producto{lowCount === 1 ? '' : 's'} con stock bajo (≤ 5 unidades)
        </p>
      )}
      <button onClick={onNew} className="w-full rounded-xl py-2.5 text-white text-sm font-semibold" style={{ backgroundColor: ACCENT }}>
        + Nuevo producto
      </button>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin productos</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: '#FFEFEF', color: ACCENT }}>
                {(p.name.trim()[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.category} · {fmt(p.price)}</p>
                <p className="text-xs" style={{ color: p.stock <= 5 ? '#b3261e' : 'rgba(26,26,46,.55)' }}>Stock: {p.stock}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => onEdit(p.id)} className="text-xs text-indigo-600 font-medium">Editar</button>
                <button onClick={() => onDelete(p.id)} className="text-xs text-red-600 font-medium">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PublicacionesTab({
  mkStep, setMkStep, onGenerate, onCopy, onOpenSettings, mkPreviewId, setMkPreviewId, mkIg, mkTk, mkFb,
}: {
  mkStep: 'idle' | 'image' | 'loading' | 'done'
  setMkStep: (s: 'idle' | 'image' | 'loading' | 'done') => void
  onGenerate: () => void
  onCopy: (msg: string) => void
  onOpenSettings: () => void
  mkPreviewId: string | null
  setMkPreviewId: (id: string | null) => void
  mkIg: string
  mkTk: string
  mkFb: string
}) {
  const handleFor = (platform: string) => (platform === 'TikTok' ? mkTk : platform === 'Facebook' ? mkFb : mkIg)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 flex-1">Sube una foto de tu producto y genera copys con IA para redes sociales.</p>
        <button onClick={onOpenSettings} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 shrink-0" title="Configuración de redes">⚙️</button>
      </div>
      {mkStep === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMkStep('image')} className="rounded-xl border border-dashed border-gray-300 py-6 text-sm text-gray-500">📷 Cámara</button>
          <button onClick={() => setMkStep('image')} className="rounded-xl border border-dashed border-gray-300 py-6 text-sm text-gray-500">🖼️ Galería</button>
        </div>
      )}
      {mkStep !== 'idle' && (
        <div className="rounded-xl bg-gray-100 h-40 flex items-center justify-center text-gray-400 text-sm">
          Vestido Negro Elegante.jpg
        </div>
      )}
      {mkStep === 'image' && (
        <button onClick={onGenerate} className="w-full rounded-xl py-2.5 text-white text-sm font-semibold" style={{ backgroundColor: ACCENT }}>
          ✨ Generar copys con IA
        </button>
      )}
      {mkStep === 'loading' && (
        <p className="text-sm text-center text-gray-500 py-4">Generando copys con IA…</p>
      )}
      {mkStep === 'done' && (
        <div className="space-y-3">
          {MK_COPIES.map((c) => {
            const open = mkPreviewId === c.platform
            return (
              <div key={c.platform} className="border border-gray-200 rounded-xl p-3">
                <p className="text-sm font-semibold mb-1">{c.icon} {c.platform}</p>
                <p className="text-sm font-medium text-gray-900">{c.hook}</p>
                <p className="text-xs text-gray-600 mt-1">{c.body}</p>
                <p className="text-xs text-indigo-500 mt-1">{c.tags}</p>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => onCopy(`Copy de ${c.platform} copiado`)} className="text-xs font-medium" style={{ color: ACCENT }}>Copiar</button>
                  <button onClick={() => onCopy(`Compartiendo copy de ${c.platform}…`)} className="text-xs font-medium text-gray-500">Compartir</button>
                </div>
                <button
                  onClick={() => setMkPreviewId(open ? null : c.platform)}
                  className="w-full flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400"
                >
                  <span>{c.icon} {c.platform} · listo para compartir</span>
                  <span className="transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
                </button>
                {open && (
                  <div
                    className="rounded-lg mt-2 p-3"
                    style={{ backgroundColor: c.platform === 'TikTok' ? '#010101' : '#FFFFFF', border: c.platform === 'TikTok' ? 'none' : '1px solid #ECEAEF' }}
                  >
                    <p className="text-xs font-semibold" style={{ color: c.platform === 'TikTok' ? '#fff' : '#1A1A2E' }}>{handleFor(c.platform)}</p>
                    <p className="text-xs mt-1" style={{ color: c.platform === 'TikTok' ? 'rgba(255,255,255,.6)' : 'rgba(26,26,46,.5)' }}>{c.hook}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClientesTab({
  groups, expandedClient, setExpandedClient, totalPending, onAbonarCuenta,
}: {
  groups: { name: string; list: (Order & { bg: string; fg: string; label: string; saldo: number })[]; pending: number; spent: number; toDeliver: number }[]
  expandedClient: string | null
  setExpandedClient: (n: string | null) => void
  totalPending: number
  onAbonarCuenta: (name: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{groups.length} cliente{groups.length === 1 ? '' : 's'}</span>
        {totalPending > 0 && <span style={{ color: '#7a5a00' }}>Pendiente total: {fmt(totalPending)}</span>}
      </div>
      {groups.map((g) => {
        const expanded = expandedClient === g.name
        return (
          <div key={g.name} className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setExpandedClient(expanded ? null : g.name)} className="w-full flex items-center gap-3 p-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: '#FFEFEF', color: ACCENT }}>
                {(g.name.trim()[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900">{g.name}</p>
                <p className="text-xs text-gray-400">{g.list.length} compra{g.list.length === 1 ? '' : 's'} · {fmt(g.spent)}</p>
              </div>
              <div className="text-right">
                {g.pending > 0 && <p className="text-xs font-medium" style={{ color: '#7a5a00' }}>{fmt(g.pending)}</p>}
                {g.toDeliver > 0 && <p className="text-xs text-gray-400">{g.toDeliver} por entregar</p>}
              </div>
              <span className="text-gray-400 text-xs transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>
            {expanded && (
              <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
                {g.list.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{o.productName} ({o.qty}x)</span>
                    <span className="font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: o.bg, color: o.fg }}>{o.label}</span>
                  </div>
                ))}
                {g.pending > 0 && (
                  <button onClick={() => onAbonarCuenta(g.name)} className="w-full mt-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
                    Abonar a cuenta ({fmt(g.pending)})
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function SaleDialog({
  products, saleProductId, setSaleProductId, saleSize, setSaleSize, saleQty, setSaleQty,
  saleClient, setSaleClient, salePayment, setSalePayment, saleStatus, setSaleStatus,
  saleProduct, saleTotal, onClose, onConfirm,
}: {
  products: Product[]
  saleProductId: string | null
  setSaleProductId: (id: string) => void
  saleSize: string
  setSaleSize: (s: string) => void
  saleQty: number
  setSaleQty: (n: number) => void
  saleClient: string
  setSaleClient: (s: string) => void
  salePayment: Payment
  setSalePayment: (p: Payment) => void
  saleStatus: OrderStatus
  setSaleStatus: (s: OrderStatus) => void
  saleProduct: Product | null
  saleTotal: string
  onClose: () => void
  onConfirm: () => void
}) {
  const valid = !!saleProductId && saleClient.trim().length > 0
  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900">Nueva venta</h3>
      <select value={saleProductId ?? ''} onChange={(e) => setSaleProductId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="" disabled>Selecciona un producto</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
        ))}
      </select>
      {saleProduct && saleProduct.sizes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {saleProduct.sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => setSaleSize(sz)}
              className="px-3 py-1 rounded-full text-xs border"
              style={{ backgroundColor: sz === saleSize ? '#FFDADA' : '#fff', color: sz === saleSize ? '#5b0010' : '#1A1A2E', borderColor: sz === saleSize ? ACCENT : '#C7C7CC' }}
            >
              {sz}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Cantidad</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setSaleQty(Math.max(1, saleQty - 1))} className="w-7 h-7 rounded-full border border-gray-300">-</button>
          <span className="text-sm font-medium">{saleQty}</span>
          <button onClick={() => setSaleQty(saleQty + 1)} className="w-7 h-7 rounded-full border border-gray-300">+</button>
        </div>
      </div>
      <input value={saleClient} onChange={(e) => setSaleClient(e.target.value)} placeholder="Nombre del cliente" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2 flex-wrap">
        {PAYMENTS.map((pm) => (
          <button key={pm} onClick={() => setSalePayment(pm)} className="px-3 py-1 rounded-full text-xs border" style={{ backgroundColor: pm === salePayment ? '#FFDADA' : '#fff', color: pm === salePayment ? '#5b0010' : '#1A1A2E', borderColor: pm === salePayment ? ACCENT : '#C7C7CC' }}>
            {pm}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['APARTADO', 'PAGADO'] as OrderStatus[]).map((v) => (
          <button key={v} onClick={() => setSaleStatus(v)} className="flex-1 px-3 py-1.5 rounded-lg text-xs border font-medium" style={{ backgroundColor: v === saleStatus ? '#FFDADA' : '#fff', color: v === saleStatus ? '#5b0010' : '#1A1A2E', borderColor: v === saleStatus ? ACCENT : '#C7C7CC' }}>
            {v === 'APARTADO' ? 'Apartado' : 'Pagado'}
          </button>
        ))}
      </div>
      <p className="text-right text-lg font-bold text-gray-900">Total: {saleTotal}</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm">Cancelar</button>
        <button onClick={onConfirm} disabled={!valid} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: valid ? ACCENT : '#E9A8B4' }}>
          Confirmar
        </button>
      </div>
    </Modal>
  )
}

function ProductFormDialog({
  formId, fName, setFName, fPrice, setFPrice, fStock, setFStock, fCat, setFCat, fDesc, setFDesc, fSizes, setFSizes, onClose, onSave,
}: {
  formId: string | null
  fName: string
  setFName: (v: string) => void
  fPrice: string
  setFPrice: (v: string) => void
  fStock: string
  setFStock: (v: string) => void
  fCat: string
  setFCat: (v: string) => void
  fDesc: string
  setFDesc: (v: string) => void
  fSizes: string[]
  setFSizes: (v: string[]) => void
  onClose: () => void
  onSave: () => void
}) {
  const valid = fName.trim().length > 0 && !isNaN(parseFloat(fPrice))
  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900">{formId ? 'Editar producto' : 'Nuevo producto'}</h3>
      <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nombre del producto" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input value={fPrice} onChange={(e) => setFPrice(e.target.value)} placeholder="Precio" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input value={fStock} onChange={(e) => setFStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Stock" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex gap-2 flex-wrap">
        {PRESET_SIZES.map((sz) => {
          const sel = fSizes.includes(sz)
          return (
            <button
              key={sz}
              onClick={() => setFSizes(sel ? fSizes.filter((x) => x !== sz) : [...fSizes, sz])}
              className="px-3 py-1 rounded-full text-xs border"
              style={{ backgroundColor: sel ? '#FFDADA' : '#fff', color: sel ? '#5b0010' : '#1A1A2E', borderColor: sel ? ACCENT : '#C7C7CC' }}
            >
              {sz}
            </button>
          )
        })}
      </div>
      <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Descripción" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm">Cancelar</button>
        <button onClick={onSave} disabled={!valid} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: valid ? ACCENT : '#E9A8B4' }}>
          {formId ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </Modal>
  )
}

function ConfirmDialog({ message, onCancel, onConfirm }: { message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <p className="text-sm text-gray-700">{message}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm">Cancelar</button>
        <button onClick={onConfirm} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold bg-red-600">Eliminar</button>
      </div>
    </Modal>
  )
}

function AbonoDialog({
  title, subtitle, saldo, amount, setAmount, onClose, onConfirm,
}: {
  title: string
  subtitle: string
  saldo: number
  amount: string
  setAmount: (v: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const num = parseFloat(amount)
  const valid = !isNaN(num) && num > 0
  const presets = [100, 200, 500].filter((v) => v < saldo)
  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500">{subtitle}</p>
      <p className="text-sm text-gray-700">Saldo pendiente: <span className="font-semibold">{fmt(saldo)}</span></p>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Monto a abonar" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2 flex-wrap">
        {presets.map((v) => (
          <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1 rounded-full text-xs border border-gray-300">${v}</button>
        ))}
        <button onClick={() => setAmount(String(saldo))} className="px-3 py-1 rounded-full text-xs border border-gray-300">Liquidar todo</button>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm">Cancelar</button>
        <button onClick={onConfirm} disabled={!valid} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: valid ? ACCENT : '#E9A8B4' }}>
          Confirmar
        </button>
      </div>
    </Modal>
  )
}

function MkSettingsDialog({
  mkIg, setMkIg, mkTk, setMkTk, mkFb, setMkFb, onClose, onSave,
}: {
  mkIg: string
  setMkIg: (v: string) => void
  mkTk: string
  setMkTk: (v: string) => void
  mkFb: string
  setMkFb: (v: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900">Configuración de redes</h3>
      <p className="text-xs text-gray-500">Conecta tus cuentas para compartir copys directamente</p>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">📸 Instagram</p>
        <input value={mkIg} onChange={(e) => setMkIg(e.target.value)} placeholder="@tutienda" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">🎵 TikTok</p>
        <input value={mkTk} onChange={(e) => setMkTk(e.target.value)} placeholder="@tutienda" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">👥 Facebook</p>
        <input value={mkFb} onChange={(e) => setMkFb(e.target.value)} placeholder="Nombre de tu página" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm">Cancelar</button>
        <button onClick={onSave} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: ACCENT }}>
          Guardar
        </button>
      </div>
    </Modal>
  )
}
