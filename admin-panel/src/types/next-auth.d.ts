import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role?: string
    type?: 'admin' | 'employee'
    storeId?: string
  }

  interface Session {
    user: {
      id?: string
      email?: string | null
      name?: string | null
      role?: string
      type?: 'admin' | 'employee'
      storeId?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    type?: 'admin' | 'employee'
    storeId?: string
  }
}
