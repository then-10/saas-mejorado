import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeOrder } from '@/lib/shop/serialize'

/** GET /api/admin/shop/orders?storeId=...&status=...&type=... */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const storeId = sp.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId es requerido' }, { status: 400 })

  const where: Record<string, unknown> = { storeId }
  if (sp.get('status')) where.status = sp.get('status')
  if (sp.get('type')) where.type = sp.get('type')

  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const pageSize = 20

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        payments: true,
        layaway: true,
        customer: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({
    orders: orders.map((o: Parameters<typeof serializeOrder>[0] & { customer: unknown }) => ({ ...serializeOrder(o), customer: o.customer })),
    total,
    page,
    pageSize,
  })
}
