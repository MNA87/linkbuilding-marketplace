import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// NextAuth's defaults: the cookie holding the login, and how long it lasts.
const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
const SESSION_COOKIE = `${secure ? "__Secure-" : ""}next-auth.session-token`;
const MAX_AGE = 30 * 24 * 60 * 60;

// Signs the user out on every device (see User.sessionVersion and the jwt
// callback in auth.ts). From a server action, `keepThisLogin` re-issues
// the login it runs under with the new number, so the one making the
// change stays signed in.
export async function signOutEverywhere(userId: string, { keepThisLogin = false } = {}) {
  const { sessionVersion } = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  if (!keepThisLogin) return;

  const secret = process.env.NEXTAUTH_SECRET;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!secret || !raw) return;
  const token = await decode({ token: raw, secret });
  if (!token || token.id !== userId) return;

  store.set(SESSION_COOKIE, await encode({ token: { ...token, sessionVersion }, secret, maxAge: MAX_AGE }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: new Date(Date.now() + MAX_AGE * 1000),
  });
}
