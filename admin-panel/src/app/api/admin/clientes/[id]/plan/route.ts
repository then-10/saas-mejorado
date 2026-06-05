import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFeaturesForPlan, ALL_FEATURE_KEYS } from '@/lib/features'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { plan } = await req.json()

    if (!['BASICO', 'PROFESIONAL', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const client = await prisma.client.findUnique({ where: { id: params.id } })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const oldPlan = client.plan

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { plan },
    })

    const enabledFeatures = getFeaturesForPlan(plan)
    const now = new Date()

    await Promise.all(
      ALL_FEATURE_KEYS.map((featureKey) => {
        const shouldEnable = enabledFeatures.includes(featureKey)
        return prisma.clientFeature.upsert({
          where: { clientId_featureKey: { clientId: params.id, featureKey } },
          update: {
            enabled: shouldEnable,
            ...(shouldEnable
              ? { enabledAt: now, disabledAt: null }
              : { disabledAt: now, enabledAt: null }),
          },
          create: {
            clientId: params.id,
            featureKey,
            enabled: shouldEnable,
            enabledAt: shouldEnable ? now : null,
          },
        })
      })
    )

    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id ?? null,
        action: `Plan cambiado: ${oldPlan} → ${plan}`,
        entityType: 'Client',
        entityId: params.id,
        details: `Funcionalidades actualizadas automáticamente`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[plan PATCH]', error)
    return NextResponse.json({ error: 'Error al cambiar plan' }, { status: 500 })
  }
}
