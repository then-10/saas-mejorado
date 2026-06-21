import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, canAccessStore } from '@/lib/shop/admin-session'

type Range = 7 | 30 | 90

/**
 * GET /api/admin/shop/stats?storeId=&period=7|30|90
 * Resumen para la pantalla de Reportes: ingresos por día, top productos,
 * distribución por método de pago y apartados activos/vencidos.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const storeId = url.searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })
  if (!canAccessStore(session, storeId)) {
    return NextResponse.json({ error: 'Sin acceso a esta tienda' }, { status: 403 })
  }

  const periodParam = Number(url.searchParams.get('period'))
  const days: Range = periodParam === 7 ? 7 : periodParam === 90 ? 90 : 30

  const sinceDay = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  sinceDay.setHours(0, 0, 0, 0)

  const paidOrders = await prisma.order.findMany({
    where: { storeId, status: 'PAID', createdAt: { gte: sinceDay } },
    select: {
      total: true,
      createdAt: true,
      items: { select: { productId: true, name: true, quantity: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const paidPayments = await prisma.payment.findMany({
    where: { status: 'PAID', paidAt: { gte: sinceDay }, order: { storeId } },
    select: { method: true, amount: true },
  })

  const layaways = await prisma.layaway.findMany({
    where: { order: { storeId }, status: 'ACTIVE' },
    select: { dueDate: true },
  })

  const totalRevenue = paidOrders.reduce((acc, o) => acc + Number(o.total), 0)

  const byDayMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(sinceDay.getTime() + i * 24 * 60 * 60 * 1000)
    byDayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const o of paidOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    byDayMap.set(key, (byDayMap.get(key) ?? 0) + Number(o.total))
  }
  const revenueByDay = Array.from(byDayMap.entries()).map(([date, total]) => ({ date, total }))

  const byMethod = new Map<string, { count: number; total: number }>()
  for (const p of paidPayments) {
    const cur = byMethod.get(p.method) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += Number(p.amount)
    byMethod.set(p.method, cur)
  }
  const paymentMethodBreakdown = Array.from(byMethod.entries()).map(([method, v]) => ({
    method,
    count: v.count,
    total: v.total,
  }))

  const productMap = new Map<string, { productId: string; name: string; quantitySold: number }>()
  for (const o of paidOrders) {
    for (const it of o.items) {
      const cur = productMap.get(it.productId) ?? { productId: it.productId, name: it.name, quantitySold: 0 }
      cur.quantitySold += it.quantity
      productMap.set(it.productId, cur)
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5)

  const now = new Date()
  const activeLayaways = layaways.length
  const overdueLayaways = layaways.filter((l) => l.dueDate < now).length

  return NextResponse.json({
    totalRevenue,
    revenueByDay,
    topProducts,
    paymentMethodBreakdown,
    activeLayaways,
    overdueLayaways,
  })
}
