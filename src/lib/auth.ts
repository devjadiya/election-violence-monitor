import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Role logic lives in ./auth/roles so it can be imported without initialising
// NextAuth. Re-exported here for backward compatibility with existing imports.
export { ROLE_HIERARCHY, hasPermission } from '@/lib/auth/roles'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          })
          if (!user || !user.isActive || !user.password) return null

          // Support both bcrypt and plain (for migration)
          const isValid = user.password.startsWith('$2')
            ? await bcrypt.compare(credentials.password as string, user.password)
            : user.password === credentials.password

          if (!isValid) return null
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = token.role
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
})