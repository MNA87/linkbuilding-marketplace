import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { isRateLimited } from '@/lib/rateLimit'

function getClientIp(req: { headers?: Record<string, string> }): string {
  const forwarded = req.headers?.['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers?.['x-real-ip'] ?? 'unknown'
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const ip = getClientIp(req)
        // Rate-limit per IP+email so one attacker can't lock out a real
        // user by hammering their address, and can't brute-force a single
        // account from one IP either.
        if (isRateLimited(`login:${ip}:${credentials.email.toLowerCase()}`)) {
          throw new Error('Te veel inlogpogingen. Probeer het over een minuut opnieuw.')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: true, company: true },
        })
        if (!user) return null
        if (user.status !== 'active') return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        // Thrown (rather than returning null) so the login page can show
        // this specific message instead of a generic "wrong credentials".
        if (!user.emailVerifiedAt) {
          throw new Error('Bevestig eerst je e-mailadres via de link die we je gestuurd hebben.')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          companyId: user.companyId,
          companyName: user.company?.name ?? null,
          sessionVersion: user.sessionVersion,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.companyName = user.companyName
        token.sessionVersion = user.sessionVersion
      } else {
        // Every later use of the login: still an active account, and not
        // signed out everywhere since (password changed or reset, e-mail
        // changed). Throwing makes NextAuth drop the session.
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { status: true, sessionVersion: true },
        })
        if (!current || current.status !== 'active' || current.sessionVersion !== (token.sessionVersion ?? 0)) {
          throw new Error('Sessie ingetrokken')
        }
      }
      // Lets the client refresh the session after a profile edit
      // (useSession().update(...)) without forcing a re-login.
      if (trigger === 'update' && session) {
        if (session.name) token.name = session.name
        if (session.companyName) token.companyName = session.companyName
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.companyId = token.companyId
      session.user.companyName = token.companyName
      return session
    },
  },
}
