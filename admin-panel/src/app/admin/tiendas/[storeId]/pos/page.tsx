import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PosRegister } from './PosRegister'

export const dynamic = 'force-dynamic'

export default async function PosPage({ params }: { params: { storeId: string } }) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { id: true, name: true } })
  if (!store) notFound()

  const products = await prisma.product.findMany({
    where: { storeId: store.id, isActive: true, stock: { gt: 0 } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true, stock: true, sizes: true, category: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/tiendas" className="hover:text-indigo-600">Tiendas</Link>
        <span>/</span>
        <Link href={`/admin/tiendas/${store.id}`} className="hover:text-indigo-600">{store.name}</Link>
        <span>/</span>
        <span className="text-gray-900">Punto de venta</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Punto de venta — {store.name}</h1>

      <PosRegister
        storeId={store.id}
        products={products.map((p) => ({ ...p, price: Number(p.price) }))}
      />
    </div>
  )
}
