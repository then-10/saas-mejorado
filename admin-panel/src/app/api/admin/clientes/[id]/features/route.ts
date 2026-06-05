import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const features = await prisma.clientFeature.findMany({
    where: { clientId: params.id },
  })

  return NextResponse.json(features)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { featureKey, enabled } = await req.json()

  const feature = await prisma.clientFeature.upsert({
    where: { clientId_featureKey: { clientId: params.id, featureKey } },
    update: {
      enabled,
      enabledAt: enabled ? new Date() : undefined,
      disabledAt: !enabled ? new Date() : undefined,
    },
    create: {
      clientId: params.id,
      featureKey,
      enabled,
      enabledAt: enabled ? new Date() : null,
    },
  })

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { name: true } })

  await prisma.activityLog.create({
    data: {
      adminId: (session.user as { id?: string }).id,
      action: `Funcionalidad ${enabled ? 'activada' : 'desactivada'}: ${featureKey}`,
      entityType: 'Client',
      entityId: params.id,
      details: `Cliente: ${client?.name}`,
    },
  })

  return NextResponse.json(feature)
}
