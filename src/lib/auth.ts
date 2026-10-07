import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { isRateLimited } from '@/lib/rateLimit'
import { decryptSecret } from '@/lib/secretBox'
import { spendBackupCode, verifyTotp } from '@/lib/totp'
import {
  DAY_LOGIN_MS,
  DEVICE_COOKIE,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  REMEMBER_DEVICE_DAYS,
  afterFailedLogin,
  describeDevice,
  deviceToken,
  isLocked,
  isRememberedDevice,
  notMeToken,
} from '@/lib/loginSecurity'
import { sendAccountLockedEmail, sendAdminLoginEmail } from '@/lib/email'

// Asked for by the login form when an account has tweestapsverificatie on:
// it then shows the field for the code from the app.
export const CODE_NEEDED = 'CODE_NODIG'

const appUrl = () => process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

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
        code: { label: 'Code', type: 'text' },
        remember: { label: 'Onthoud mij', type: 'text' },
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
        if (isLocked(user.lockedUntil)) {
          throw new Error(
            `Dit account staat tijdelijk op slot na ${MAX_FAILED_LOGINS} foute pogingen. Probeer het over ${LOCK_MINUTES} minuten opnieuw, of kies een nieuw wachtwoord.`
          )
        }

        // A wrong password or code counts towards the lock (10 in a row
        // locks the account for a while, with a mail to its owner).
        const failed = async () => {
          const next = afterFailedLogin(user.failedLogins)
          await prisma.user.update({ where: { id: user.id }, data: next })
          if (next.lockedUntil) void sendAccountLockedEmail(user.email, LOCK_MINUTES, `${appUrl()}/forgot-password`)
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          await failed()
          return null
        }

        // Thrown (rather than returning null) so the login page can show
        // this specific message instead of a generic "wrong credentials".
        if (!user.emailVerifiedAt) {
          throw new Error('Bevestig eerst je e-mailadres via de link die we je gestuurd hebben.')
        }

        // "Onthoud mij" (on unless the form says '0'): stay logged in for 30
        // days instead of 1, and with tweestapsverificatie skip the code on
        // this device for 30 days.
        const remember = credentials.remember !== '0'

        // Tweestapsverificatie: the code from the app, or a reservecode
        // (each works once). Not on a device remembered for this user.
        if (user.totpEnabledAt && user.totpSecret) {
          const store = await cookies()
          const stamp = `${user.sessionVersion}.${user.totpEnabledAt.getTime()}`
          const code = credentials.code?.trim() ?? ''
          const remembered = isRememberedDevice(store.get(DEVICE_COOKIE)?.value, user.id, stamp)
          if (!code && !remembered) throw new Error(CODE_NEEDED)
          const secret = decryptSecret(user.totpSecret)
          const leftover =
            !code || /^\d{6}$/.test(code.replace(/\s/g, '')) ? null : spendBackupCode(user.totpBackupCodes, code)
          if (code && !(secret && verifyTotp(secret, code)) && !leftover) {
            await failed()
            throw new Error('Deze code klopt niet. Probeer de nieuwste code uit je app.')
          }
          if (leftover) await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: leftover } })
          if (!remember) store.delete(DEVICE_COOKIE)
          else if (code) {
            store.set(DEVICE_COOKIE, deviceToken(user.id, stamp), {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              secure: appUrl().startsWith('https://'),
              maxAge: REMEMBER_DEVICE_DAYS * 86_400,
            })
          }
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
        }

        // Every admin login gets a mail, so a stranger's stands out.
        if (user.role.name === 'admin') {
          void sendAdminLoginEmail(user.email, {
            when: new Date().toLocaleString('nl-NL', {
              timeZone: 'Europe/Amsterdam',
              dateStyle: 'long',
              timeStyle: 'short',
            }),
            device: describeDevice(req.headers?.['user-agent']),
            ip,
            notMeUrl: `${appUrl()}/niet-ik?t=${notMeToken(user.id)}`,
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          companyId: user.companyId,
          companyName: user.company?.name ?? null,
          sessionVersion: user.sessionVersion,
          remember,
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
        token.loginAt = Date.now()
        token.remember = user.remember
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
        // An admin login lasts a day, and so does one without "Onthoud mij";
        // then log in again.
        if ((token.role === 'admin' || token.remember === false) && Date.now() - (token.loginAt ?? 0) > DAY_LOGIN_MS) {
          throw new Error('Inlog verlopen')
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
