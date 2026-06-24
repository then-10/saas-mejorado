import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const email = credentials.email.toLowerCase()

        const admin = await prisma.adminUser.findUnique({ where: { email } })
        if (admin && (await bcrypt.compare(credentials.password, admin.passwordHash))) {
          return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            type: 'admin' as const,
          }
        }

        // No es AdminUser (super-admin): puede ser dueño/empleado de una tienda
        // específica. El email de Employee solo es único por tienda, así que
        // se revisan todas las coincidencias hasta encontrar el hash correcto.
        const employees = await prisma.employee.findMany({
          where: { email, active: true },
          include: { store: { select: { isActive: true } } },
        })
        for (const employee of employees) {
          if (await bcrypt.compare(credentials.password, employee.passwordHash)) {
            if (!employee.store.isActive) return null
            return {
              id: employee.id,
              email: employee.email,
              name: employee.name,
              role: employee.role,
              type: 'employee' as const,
              storeId: employee.storeId,
            }
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role?: string; type?: 'admin' | 'employee'; storeId?: string }
        token.id = u.id
        token.role = u.role
        token.type = u.type ?? 'admin'
        token.storeId = u.storeId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { id?: string; role?: string; type?: string; storeId?: string }
        u.id = token.id as string
        u.role = token.role as string
        u.type = (token.type as string) ?? 'admin'
        u.storeId = token.storeId as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
