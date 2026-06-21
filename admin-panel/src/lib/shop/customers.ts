import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'

/** slug determinístico del nombre del cliente, usado para construir su email sintético. */
export function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'cliente'
  )
}

/**
 * Busca o crea un Customer real a partir solo del nombre escrito por el dueño (POS o alta manual).
 * Como el schema exige email único + passwordHash, se sintetiza un email determinístico
 * por nombre+tienda (`<slug>.<storeId>@pos.local`) para que el mismo nombre reutilice
 * siempre el mismo Customer entre visitas (historial y deuda correctos en Clientes).
 */
export async function findOrCreateNamedCustomer(
  tx: Prisma.TransactionClient,
  storeId: string,
  name: string,
  phone?: string | null,
) {
  const trimmedName = name.trim()
  const email = `${slugifyName(trimmedName)}.${storeId}@pos.local`
  return tx.customer.upsert({
    where: { storeId_email: { storeId, email } },
    update: phone ? { phone } : {},
    create: {
      storeId,
      name: trimmedName,
      email,
      phone: phone ?? null,
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
    },
  })
}
