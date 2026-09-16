import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewWebsiteForm from "./NewWebsiteForm";

export default async function AdminNewWebsitePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [categories, countries, languages] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Nieuwe website toevoegen</h1>
      <p className="text-sm text-inkSoft mb-6">Meteen actief in de marketplace, geen beoordeling nodig.</p>
      <NewWebsiteForm categories={categories} countries={countries} languages={languages} />
    </div>
  );
}
