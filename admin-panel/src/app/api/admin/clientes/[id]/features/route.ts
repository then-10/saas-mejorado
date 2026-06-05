import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const features = await prisma.clientFeature.findMany({
      where: { clientId: params.id },
    })
    return NextResponse.json(features)
  } catch (error) {
    console.error('[features GET]', error)
    return NextResponse.json({ error: 'Error al obtener funcionalidades' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { featureKey, enabled } = await req.json()

    const feature = await prisma.clientFeature.upsert({
      where: { clientId_featureKey: { clientId: params.id, featureKey } },
      update: {
        enabled,
        ...(enabled
          ? { enabledAt: new Date(), disabledAt: null }
          : { disabledAt: new Date(), enabledAt: null }),
      },
      create: {
        clientId: params.id,
        featureKey,
        enabled,
        enabledAt: enabled ? new Date() : null,
      },
    })

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { name: true },
    })

    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: `Funcionalidad ${enabled ? 'activada' : 'desactivada'}: ${featureKey}`,
        entityType: 'Client',
        entityId: params.id,
        details: `Cliente: ${client?.name}`,
      },
    })

    return NextResponse.json(feature)
  } catch (error) {
    console.error('[features PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar funcionalidad' }, { status: 500 })
  }
}
