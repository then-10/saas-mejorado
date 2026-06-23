import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StoreConfigForm } from './StoreConfigForm'

export const dynamic = 'force-dynamic'

export default async function StoreConfigPage({ params }: { params: { storeId: string } }) {
  const store = await prisma.store.findUnique({
    where: { id: params.storeId },
    select: {
      id: true, name: true, paymentProvider: true,
      layawayDepositPct: true, layawayDays: true, address: true,
      mpAccessTokenEnc: true, conektaKeyEnc: true, apiKey: true,
      iaMarketingEnabled: true,
    },
  })
  if (!store) notFound()

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/tiendas/${params.storeId}`} className="text-xs text-gray-500 hover:text-gray-700">
          ← {store.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Configuración</h1>
        <p className="text-sm text-gray-500">Parámetros del módulo e-commerce</p>
      </header>

      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Identidad</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wider">ID interno</dt>
            <dd className="font-mono text-xs">{store.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wider">X-Tenant-Key (app)</dt>
            <dd>
              <code className="text-xs bg-gray-100 rounded px-2 py-1 select-all break-all">
                {store.apiKey}
              </code>
            </dd>
          </div>
        </dl>
      </section>

      <StoreConfigForm
        storeId={store.id}
        initial={{
          name: store.name,
          paymentProvider: store.paymentProvider,
          layawayDepositPct: store.layawayDepositPct,
          layawayDays: store.layawayDays,
          address: store.address ?? '',
          hasMpKey: Boolean(store.mpAccessTokenEnc),
          hasConektaKey: Boolean(store.conektaKeyEnc),
          iaMarketingEnabled: store.iaMarketingEnabled,
        }}
      />
    </div>
  )
}
