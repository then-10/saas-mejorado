import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '../../ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: { params: { storeId: string; productId: string } }) {
  const [store, product] = await Promise.all([
    prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } }),
    prisma.product.findFirst({ where: { id: params.productId, storeId: params.storeId } }),
  ])
  if (!store || !product) notFound()

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/tiendas/${params.storeId}/productos`} className="text-xs text-gray-500 hover:text-gray-700">
          ← Productos de {store.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Editar producto</h1>
        <p className="text-xs text-gray-400 font-mono mt-1">{product.id}</p>
      </header>
      <ProductForm
        storeId={params.storeId}
        mode="edit"
        initial={{
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          price: Number(product.price),
          imageUrl: product.imageUrl ?? '',
          category: product.category,
          sizes: product.sizes,
          stock: product.stock,
          isActive: product.isActive,
        }}
      />
    </div>
  )
}
