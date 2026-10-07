"use server";

import { getServerSession } from "next-auth";
import QRCode from "qrcode";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { hashBackupCode, newBackupCodes, newTotpSecret, spendBackupCode, totpUri, verifyTotp } from "@/lib/totp";

// Tweestapsverificatie for the account that's logged in (Account →
// Inloggen; required for the admin): set it up with the app, turn it off,
// or get new reservecodes. Turning off or new codes takes a current code.

const ISSUER = "Nugevonden";

async function me() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, totpSecret: true, totpEnabledAt: true, totpBackupCodes: true },
  });
}

// A new secret, waiting for the first code from the app: the QR code to
// scan, and the key to type in when scanning doesn't work.
export async function startTwoFactorAction(): Promise<{ error: string | null; qr?: string; key?: string }> {
  const user = await me();
  if (!user) return { error: "Niet toegestaan." };
  if (user.totpEnabledAt) return { error: "Tweestapsverificatie staat al aan." };
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(secret) } });
  const qr = await QRCode.toDataURL(totpUri(secret, user.email, ISSUER), { margin: 1, width: 200 });
  return { error: null, qr, key: secret.replace(/(.{4})/g, "$1 ").trim() };
}

// The first code from the app: on from now, with the reservecodes, shown once.
export async function confirmTwoFactorAction(code: string): Promise<{ error: string | null; backupCodes?: string[] }> {
  const user = await me();
  if (!user) return { error: "Niet toegestaan." };
  const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
  if (!secret || user.totpEnabledAt) return { error: "Begin opnieuw met Aanzetten." };
  if (!verifyTotp(secret, String(code))) return { error: "Deze code klopt niet. Probeer de nieuwste code uit je app." };
  const backupCodes = newBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date(), totpBackupCodes: backupCodes.map(hashBackupCode) },
  });
  return { error: null, backupCodes };
}

// A current code from the app, or a reservecode.
function codeOk(user: { totpSecret: string | null; totpBackupCodes: string[] }, code: string) {
  const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
  return Boolean((secret && verifyTotp(secret, code)) || spendBackupCode(user.totpBackupCodes, code));
}

export async function disableTwoFactorAction(code: string): Promise<{ error: string | null }> {
  const user = await me();
  if (!user?.totpEnabledAt) return { error: "Tweestapsverificatie staat niet aan." };
  if (!codeOk(user, String(code))) return { error: "Deze code klopt niet." };
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null, totpBackupCodes: [] },
  });
  return { error: null };
}

export async function newBackupCodesAction(code: string): Promise<{ error: string | null; backupCodes?: string[] }> {
  const user = await me();
  if (!user?.totpEnabledAt) return { error: "Tweestapsverificatie staat niet aan." };
  if (!codeOk(user, String(code))) return { error: "Deze code klopt niet." };
  const backupCodes = newBackupCodes();
  await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: backupCodes.map(hashBackupCode) } });
  return { error: null, backupCodes };
}
