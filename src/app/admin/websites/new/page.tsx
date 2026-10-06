import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_TYPES } from "@/lib/websiteProducts";
import NewWebsiteWizard from "./NewWebsiteWizard";

export const metadata: Metadata = { title: "Nieuwe website" };

export default async function AdminNewWebsitePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [niches, countries, languages, topics] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-5xl">
      <Link href="/admin/websites" className="text-sm text-inkSoft hover:text-ink">
        ← Websites
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">Nieuwe website</h1>
      <p className="mt-1 text-sm text-inkSoft">
        Meteen actief in het overzicht. Cijfers (DR, DA, verkeer) worden daarna automatisch opgehaald.
      </p>
      <NewWebsiteWizard
        initialDetails={{
          domain: "",
          description: "",
          // Most sites are Dutch: start there.
          countryId: countries.find((c) => c.code.toUpperCase() === "NL")?.id ?? "",
          languageId: languages.find((l) => l.code.toLowerCase() === "nl")?.id ?? "",
          nicheIds: [],
          maxLinks: "",
          sponsored: false,
          exampleUrl: "",
        }}
        initialPrices={PRODUCT_TYPES.map((type) => ({
          type,
          enabled: type === "BLOG_POST",
          periodic: type === "HOMEPAGE_LINK",
          prices: {},
        }))}
        countries={countries.map(({ id, name }) => ({ id, name }))}
        languages={languages.map(({ id, name }) => ({ id, name }))}
        niches={niches}
        topics={topics}
      />
    </div>
  );
}
