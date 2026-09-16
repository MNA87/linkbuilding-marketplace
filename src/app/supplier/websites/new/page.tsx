import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewWebsiteForm from "./NewWebsiteForm";

export const metadata: Metadata = { title: "Nieuwe website" };

export default async function NewWebsitePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier") redirect("/login");

  const [categories, countries, languages] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Nieuwe website toevoegen</h1>
      <p className="text-sm text-inkSoft mb-6">
        Na het indienen beoordeelt het platform je website voordat &apos;m zichtbaar wordt in de marketplace.
      </p>
      <NewWebsiteForm categories={categories} countries={countries} languages={languages} />
    </div>
  );
}
