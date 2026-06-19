import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const seedPassword = process.env.SEED_ADMIN_PASSWORD
  if (!seedPassword) {
    throw new Error('SEED_ADMIN_PASSWORD no está definida. No se generan contraseñas por defecto.')
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12)

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@saas.com' },
    update: {},
    create: {
      email: 'admin@saas.com',
      passwordHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  })

  console.log('Seeded admin user:', admin.email)

  // Seed some demo clients
  const clients = [
    {
      name: 'Restaurante El Buen Sabor',
      email: 'contacto@buensabor.com',
      phone: '+52 55 1234 5678',
      businessType: 'RESTAURANTE' as const,
      plan: 'PROFESIONAL' as const,
      status: 'ACTIVO' as const,
      contactName: 'Carlos Mendoza',
      city: 'Ciudad de México',
      monthlyLeads: 245,
    },
    {
      name: 'Boutique Moda Rosa',
      email: 'hola@modarosa.mx',
      phone: '+52 33 9876 5432',
      businessType: 'TIENDA_ROPA' as const,
      plan: 'BASICO' as const,
      status: 'ACTIVO' as const,
      contactName: 'Ana García',
      city: 'Guadalajara',
      monthlyLeads: 87,
    },
    {
      name: 'Café Central',
      email: 'info@cafecentral.com',
      phone: '+52 81 5555 1234',
      businessType: 'CAFETERIA' as const,
      plan: 'ENTERPRISE' as const,
      status: 'ACTIVO' as const,
      contactName: 'Roberto Silva',
      city: 'Monterrey',
      monthlyLeads: 512,
    },
    {
      name: 'Tacos Don Pepe',
      email: 'donpepe@tacos.mx',
      businessType: 'RESTAURANTE' as const,
      plan: 'BASICO' as const,
      status: 'PRUEBA' as const,
      contactName: 'José Pérez',
      city: 'Puebla',
      monthlyLeads: 12,
    },
    {
      name: 'Tienda Sport Total',
      email: 'ventas@sporttotal.mx',
      phone: '+52 55 7777 8888',
      businessType: 'TIENDA_ROPA' as const,
      plan: 'PROFESIONAL' as const,
      status: 'SUSPENDIDO' as const,
      contactName: 'Luis Hernández',
      city: 'Ciudad de México',
      monthlyLeads: 0,
    },
  ]

  for (const clientData of clients) {
    const client = await prisma.client.upsert({
      where: { email: clientData.email },
      update: {},
      create: clientData,
    })

    // Seed features based on plan
    const planFeatures: Record<string, string[]> = {
      BASICO: ['chatbot_basico', 'whatsapp', 'menu_digital', 'catalogo_digital'],
      PROFESIONAL: [
        'chatbot_basico', 'chatbot_ia', 'whatsapp', 'telegram',
        'menu_digital', 'catalogo_digital', 'reservaciones',
        'crm_basico', 'analytics_basico', 'notificaciones_email',
      ],
      ENTERPRISE: [
        'chatbot_basico', 'chatbot_ia', 'whatsapp', 'telegram',
        'menu_digital', 'catalogo_digital', 'reservaciones',
        'crm_basico', 'crm_avanzado', 'analytics_basico',
        'analytics_avanzado', 'notificaciones_email', 'notificaciones_sms',
        'soporte_prioritario',
      ],
    }

    const enabledFeatures = planFeatures[client.plan] || []
    const allFeatures = [
      'chatbot_basico', 'chatbot_ia', 'whatsapp', 'telegram',
      'menu_digital', 'catalogo_digital', 'reservaciones',
      'crm_basico', 'crm_avanzado', 'analytics_basico',
      'analytics_avanzado', 'notificaciones_email', 'notificaciones_sms',
      'soporte_prioritario',
    ]

    for (const featureKey of allFeatures) {
      await prisma.clientFeature.upsert({
        where: { clientId_featureKey: { clientId: client.id, featureKey } },
        update: {},
        create: {
          clientId: client.id,
          featureKey,
          enabled: enabledFeatures.includes(featureKey),
          enabledAt: enabledFeatures.includes(featureKey) ? new Date() : null,
        },
      })
    }

    console.log('Seeded client:', client.name)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
