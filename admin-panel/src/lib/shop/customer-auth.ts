import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const secret = () => {
  const s = process.env.SHOP_JWT_SECRET
  if (!s) throw new Error('SHOP_JWT_SECRET no está configurado')
  return new TextEncoder().encode(s)
}

export interface CustomerToken {
  customerId: string
  storeId: string
}

/** Emite un JWT de cliente final (30 días). Separado del JWT de NextAuth. */
export async function signCustomerToken(payload: CustomerToken): Promise<string> {
  return new SignJWT({ storeId: payload.storeId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.customerId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

/**
 * Verifica el Bearer token del cliente y que pertenezca a la tienda
 * resuelta por X-Tenant-Key (aislamiento multi-tenant).
 */
export async function verifyCustomer(
  req: NextRequest,
  storeId: string
): Promise<CustomerToken | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jwtVerify(auth.slice(7), secret())
    if (!payload.sub || payload.storeId !== storeId) return null
    return { customerId: payload.sub, storeId: storeId }
  } catch {
    return null
  }
}

export function unauthorizedCustomer() {
  return Response.json({ error: 'Sesión inválida o expirada' }, { status: 401 })
}
