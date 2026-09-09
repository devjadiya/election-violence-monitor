import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { recordLoginAttempt } from '@/lib/auth/login-events'
import type { UserRole } from '@/lib/generated/prisma'

// Role logic lives in ./auth/roles so it can be imported without initialising
// NextAuth. Re-exported here for backward compatibility with existing imports.
export { ROLE_HIERARCHY, hasPermission } from '@/lib/auth/roles'

/**
 * The shape this app puts on the token and the session.
 *
 * Declared rather than reached for with `as any` in four places: the role is
 * the input to every authorization decision in the codebase, and a cast is
 * exactly where a wrong one would slip through unnoticed.
 */
interface AuthedUser {
  id: string
  email: string
  name: string | null
  role: UserRole
}

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
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''

        if (!email || !password) {
          if (email) {
            await recordLoginAttempt({ email, success: false, reason: 'missing-credentials' })
          }
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          })

          // Each failure is recorded with its real cause so an administrator
          // can tell a colleague's typo from someone working through a list of
          // addresses. None of it is returned to the caller: the sign-in form
          // says only that the credentials were wrong.
          if (!user) {
            await recordLoginAttempt({ email, success: false, reason: 'no-such-account' })
            return null
          }
          if (!user.isActive) {
            await recordLoginAttempt({
              email,
              success: false,
              userId: user.id,
              reason: 'account-disabled',
            })
            return null
          }
          if (!user.password) {
            await recordLoginAttempt({
              email,
              success: false,
              userId: user.id,
              reason: 'no-password-set',
            })
            return null
          }

          // Hashed comparison only. A previous plaintext fallback compared
          // `user.password === credentials.password` for any value not
          // starting with "$2", which meant an unhashed row was a working
          // credential. Verified against production on 2026-09-09: all six
          // accounts store bcrypt hashes, so removing it locks nobody out.
          const isValid = await bcrypt.compare(password, user.password)
          if (!isValid) {
            await recordLoginAttempt({
              email,
              success: false,
              userId: user.id,
              reason: 'wrong-password',
            })
            return null
          }

          await recordLoginAttempt({ email, success: true, userId: user.id })

          const authed: AuthedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
          return authed
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authed = user as Partial<AuthedUser>
        token.role = authed.role
        token.id = authed.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const target = session.user as typeof session.user & { role?: UserRole }
        target.role = token.role as UserRole | undefined
        if (typeof token.id === 'string') target.id = token.id
      }
      return session
    },
  },
})
