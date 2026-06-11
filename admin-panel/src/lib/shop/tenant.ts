import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Store } from '@prisma/client'

/**
 * Resuelve la tienda (tenant) a partir del header X-Tenant-Key
 * que envía la app Android. Solo tiendas de clientes ACTIVO o PRUEBA.
 */
export async function resolveStore(req: NextRequest): Promise<Store | null> {
  const apiKey = req.headers.get('x-tenant-key')
  if (!apiKey) return null

  const store = await prisma.store.findUnique({
    where: { apiKey },
    include: { client: { select: { status: true } } },
  })
  if (!store) return null
  if (store.client.status === 'SUSPENDIDO') return null

  return store
}

export function unauthorizedTenant() {
  return Response.json(
    { error: 'Tienda no válida o suspendida. Verifica X-Tenant-Key.' },
    { status: 401 }
  )
}
