import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ClientForm from '@/components/ClientForm'
import Link from 'next/link'

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({ where: { id: params.id } })
  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/clientes" className="hover:text-indigo-600">Clientes</Link>
          <span>/</span>
          <Link href={`/admin/clientes/${client.id}`} className="hover:text-indigo-600">{client.name}</Link>
          <span>/</span>
          <span className="text-gray-900">Editar</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Cliente</h1>
      </div>
      <ClientForm client={client} />
    </div>
  )
}
