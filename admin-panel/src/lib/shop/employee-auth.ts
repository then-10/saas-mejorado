import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const secret = () => {
  const s = process.env.SHOP_JWT_SECRET
  if (!s) throw new Error('SHOP_JWT_SECRET no está configurado')
  return new TextEncoder().encode(s)
}

export interface EmployeeToken {
  employeeId: string
  storeId: string
  role: 'OWNER' | 'STAFF'
}

/** Emite un JWT de empleado del POS (12h). Claim `typ: "employee"` lo distingue del JWT de Customer. */
export async function signEmployeeToken(payload: EmployeeToken): Promise<string> {
  return new SignJWT({ storeId: payload.storeId, role: payload.role, typ: 'employee' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.employeeId)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret())
}

/**
 * Verifica el Bearer token del empleado y que pertenezca a la tienda
 * resuelta por X-Tenant-Key (aislamiento multi-tenant).
 */
export async function verifyEmployee(
  req: NextRequest,
  storeId: string
): Promise<EmployeeToken | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jwtVerify(auth.slice(7), secret())
    if (!payload.sub || payload.typ !== 'employee' || payload.storeId !== storeId) return null
    const role = payload.role === 'OWNER' ? 'OWNER' : 'STAFF'
    return { employeeId: payload.sub, storeId, role }
  } catch {
    return null
  }
}

export function unauthorizedEmployee() {
  return Response.json({ error: 'Sesión de empleado inválida o expirada' }, { status: 401 })
}
