"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

type ActionState = { error: string | null; success: boolean };

const nameSchema = z.string().trim().min(2, "Minimaal 2 tekens").max(100);
const codeSchema = z.string().trim().min(2, "Minimaal 2 tekens").max(10);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

export async function addCategoryAction(name: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.category.create({ data: { name: parsed.data } });
    return { error: null, success: true };
  } catch {
    return { error: "Deze categorie bestaat al.", success: false };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.category.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Deze categorie is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

export async function addCountryAction(name: string, code: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsedName = nameSchema.safeParse(name);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Ongeldig", success: false };
  if (!parsedCode.success) return { error: parsedCode.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.country.create({ data: { name: parsedName.data, code: parsedCode.data.toUpperCase() } });
    return { error: null, success: true };
  } catch {
    return { error: "Dit land of deze code bestaat al.", success: false };
  }
}

export async function deleteCountryAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.country.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Dit land is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

export async function addLanguageAction(name: string, code: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsedName = nameSchema.safeParse(name);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Ongeldig", success: false };
  if (!parsedCode.success) return { error: parsedCode.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.language.create({ data: { name: parsedName.data, code: parsedCode.data.toLowerCase() } });
    return { error: null, success: true };
  } catch {
    return { error: "Deze taal of code bestaat al.", success: false };
  }
}

export async function deleteLanguageAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.language.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Deze taal is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}
