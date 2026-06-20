import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type AdminSession = Session & {
  user: NonNullable<Session['user']> & { type?: 'admin' | 'employee'; storeId?: string }
}

/**
 * Sesión NextAuth (cookie) ya sea de AdminUser (super-admin, acceso a todas
 * las tiendas) o Employee (dueño/staff, acceso solo a su storeId). Null si
 * no hay sesión.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session as AdminSession
}

/**
 * Si la sesión es de un Employee, valida que storeId coincida con el de su
 * tienda. Si es AdminUser, siempre permite (ve todas las tiendas). Devuelve
 * `true` si el acceso está permitido.
 */
export function canAccessStore(session: AdminSession, storeId: string): boolean {
  if (session.user.type === 'employee') return session.user.storeId === storeId
  return true
}
