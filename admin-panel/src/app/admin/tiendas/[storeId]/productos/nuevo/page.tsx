import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '../ProductForm'

export const dynamic = 'force-dynamic'

export default async function NewProductPage({ params }: { params: { storeId: string } }) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
  if (!store) notFound()

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/tiendas/${params.storeId}/productos`} className="text-xs text-gray-500 hover:text-gray-700">
          ← Productos de {store.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Nuevo producto</h1>
      </header>
      <ProductForm storeId={params.storeId} mode="create" />
    </div>
  )
}
