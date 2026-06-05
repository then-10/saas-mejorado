import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_PRICES } from '@/lib/features'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totalClients, byStatus, byPlan, byBusinessType] = await Promise.all([
    prisma.client.count(),
    prisma.client.groupBy({ by: ['status'], _count: true }),
    prisma.client.groupBy({ by: ['plan'], _count: true }),
    prisma.client.groupBy({ by: ['businessType'], _count: true }),
  ])

  const activeClients = byStatus.find((s) => s.status === 'ACTIVO')?._count ?? 0
  const trialClients = byStatus.find((s) => s.status === 'PRUEBA')?._count ?? 0
  const suspendedClients = byStatus.find((s) => s.status === 'SUSPENDIDO')?._count ?? 0

  const activeByPlan = await prisma.client.groupBy({
    by: ['plan'],
    where: { status: 'ACTIVO' },
    _count: true,
  })

  let revenue = 0
  for (const g of activeByPlan) {
    revenue += (PLAN_PRICES[g.plan] ?? 0) * g._count
  }

  return NextResponse.json({
    totalClients,
    activeClients,
    trialClients,
    suspendedClients,
    estimatedRevenue: revenue,
    byPlan,
    byBusinessType,
  })
}
