import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductActiveToggle } from './ProductActiveToggle'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({
  params, searchParams,
}: {
  params: { storeId: string }
  searchParams: { filter?: string }
}) {
  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
  if (!store) notFound()

  const filter = searchParams.filter ?? 'active'
  const where: { storeId: string; isActive?: boolean; stock?: { lte: number } } = { storeId: params.storeId }
  if (filter === 'active') where.isActive = true
  if (filter === 'inactive') where.isActive = false
  if (filter === 'low') { where.isActive = true; where.stock = { lte: 5 } }

  const products = await prisma.product.findMany({
    where, orderBy: [{ stock: 'asc' }, { name: 'asc' }], take: 200,
  })

  const counts = await prisma.product.groupBy({
    by: ['isActive'],
    where: { storeId: params.storeId },
    _count: true,
  })
  const activeCount = counts.find((c) => c.isActive)?._count ?? 0
  const inactiveCount = counts.find((c) => !c.isActive)?._count ?? 0

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href={`/admin/tiendas/${params.storeId}`} className="text-xs text-gray-500 hover:text-gray-700">
            ← {store.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Productos</h1>
        </div>
        <Link
          href={`/admin/tiendas/${params.storeId}/productos/nuevo`}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700"
        >+ Nuevo producto</Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Filter href={`/admin/tiendas/${params.storeId}/productos?filter=active`} label={`Activos (${activeCount})`} active={filter === 'active'} />
        <Filter href={`/admin/tiendas/${params.storeId}/productos?filter=low`} label="Stock bajo (≤5)" active={filter === 'low'} />
        <Filter href={`/admin/tiendas/${params.storeId}/productos?filter=inactive`} label={`Inactivos (${inactiveCount})`} active={filter === 'inactive'} />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-gray-600" colSpan={2}>Producto</th>
              <th className="px-4 py-3 font-medium text-gray-600">Categoría</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Precio</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Stock</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin productos para este filtro.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="pl-4 py-2 w-12">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt="" width={40} height={40} className="rounded object-cover" unoptimized />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded" />
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/tiendas/${params.storeId}/productos/${p.id}/editar`}
                    className="font-medium text-indigo-600 hover:text-indigo-800"
                  >{p.name}</Link>
                  <div className="text-xs text-gray-500 line-clamp-1">{p.description}</div>
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">{p.category}</td>
                <td className="px-4 py-2 text-right">
                  ${Number(p.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={p.stock <= 5 ? 'font-medium text-amber-700' : ''}>{p.stock}</span>
                </td>
                <td className="px-4 py-2">
                  <ProductActiveToggle productId={p.id} isActive={p.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1 rounded-full ${
        active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >{label}</Link>
  )
}
