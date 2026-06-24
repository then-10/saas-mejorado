import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type AdminSession = Session & {
  user: NonNullable<Session['user']> & { type?: 'admin' | 'employee'; storeId?: string }
}

/**
 * Sesión NextAuth (cookie) ya sea de AdminUser (super-admin, acceso a todas
 * las tiendas) o Employee (dueño/staff, acceso solo a su storeId). Null si
 * no hay sesión.
 *
 * Para Employee se revalida `store.isActive` en cada llamada: el JWT es de
 * larga duración y no se invalida solo, así que una tienda desactivada en
 * caliente debe cortar el acceso aunque la sesión ya estuviera emitida.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const adminSession = session as AdminSession
  if (adminSession.user.type === 'employee') {
    if (!adminSession.user.storeId) return null
    const store = await prisma.store.findUnique({
      where: { id: adminSession.user.storeId },
      select: { isActive: true },
    })
    if (!store?.isActive) return null
  }
  return adminSession
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
