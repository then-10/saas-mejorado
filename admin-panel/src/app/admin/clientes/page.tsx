import { prisma } from '@/lib/prisma'
import { PLAN_LABELS, BUSINESS_TYPE_LABELS } from '@/lib/features'
import Link from 'next/link'
import ClientsTable from '@/components/ClientsTable'

async function getClients(searchParams: {
  q?: string; plan?: string; status?: string; tipo?: string; page?: string
}) {
  const page = parseInt(searchParams.page || '1')
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}

  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { email: { contains: searchParams.q, mode: 'insensitive' } },
      { contactName: { contains: searchParams.q, mode: 'insensitive' } },
      { city: { contains: searchParams.q, mode: 'insensitive' } },
    ]
  }

  if (searchParams.plan && ['BASICO', 'PROFESIONAL', 'ENTERPRISE'].includes(searchParams.plan)) {
    where.plan = searchParams.plan
  }

  if (searchParams.status && ['ACTIVO', 'SUSPENDIDO', 'PRUEBA'].includes(searchParams.status)) {
    where.status = searchParams.status
  }

  if (searchParams.tipo && ['RESTAURANTE', 'TIENDA_ROPA', 'CAFETERIA', 'OTRO'].includes(searchParams.tipo)) {
    where.businessType = searchParams.tipo
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ])

  return { clients, total, page, pageSize }
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; plan?: string; status?: string; tipo?: string; page?: string }
}) {
  const { clients, total, page, pageSize } = await getClients(searchParams)
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{total} cliente{total !== 1 ? 's' : ''} en total</p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Cliente
        </Link>
      </div>

      {/* Filters */}
      <ClientsTable
        clients={clients}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        searchParams={searchParams}
      />
    </div>
  )
}
