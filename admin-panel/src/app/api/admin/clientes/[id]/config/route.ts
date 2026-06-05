import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cfg = await prisma.clientConfig.findUnique({ where: { clientId: params.id } })
  return NextResponse.json(cfg?.config ?? {})
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { featureKey, values } = await req.json()

  const existing = await prisma.clientConfig.findUnique({ where: { clientId: params.id } })
  const current = (existing?.config as Record<string, unknown>) ?? {}

  const updated = await prisma.clientConfig.upsert({
    where: { clientId: params.id },
    update: { config: { ...current, [featureKey]: values } },
    create: { clientId: params.id, config: { [featureKey]: values } },
  })

  await prisma.activityLog.create({
    data: {
      adminId: (session.user as { id?: string }).id,
      action: `Configuración actualizada: ${featureKey}`,
      entityType: 'Client',
      entityId: params.id,
    },
  })

  return NextResponse.json(updated.config)
}
