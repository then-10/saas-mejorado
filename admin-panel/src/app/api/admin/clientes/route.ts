import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFeaturesForPlan, ALL_FEATURE_KEYS } from '@/lib/features'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const plan = searchParams.get('plan')
  const status = searchParams.get('status')
  const businessType = searchParams.get('businessType')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (plan) where.plan = plan
  if (status) where.status = status
  if (businessType) where.businessType = businessType

  const [clients, total] = await Promise.all([
    prisma.client.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.client.count({ where }),
  ])

  return NextResponse.json({ clients, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, email, phone, businessType, plan, status, contactName, address, city, notes } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone: phone || null,
        businessType: businessType || 'OTRO',
        plan: plan || 'BASICO',
        status: status || 'PRUEBA',
        contactName: contactName || null,
        address: address || null,
        city: city || null,
        notes: notes || null,
      },
    })

    // Create features based on plan
    const enabledFeatures = getFeaturesForPlan(client.plan)
    await Promise.all(
      ALL_FEATURE_KEYS.map((featureKey) =>
        prisma.clientFeature.create({
          data: {
            clientId: client.id,
            featureKey,
            enabled: enabledFeatures.includes(featureKey),
            enabledAt: enabledFeatures.includes(featureKey) ? new Date() : null,
          },
        })
      )
    )

    // Log activity
    await prisma.activityLog.create({
      data: {
        adminId: (session.user as { id?: string }).id,
        action: `Cliente creado: ${client.name}`,
        entityType: 'Client',
        entityId: client.id,
        details: `Plan: ${client.plan}, Estado: ${client.status}`,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
  }
}
