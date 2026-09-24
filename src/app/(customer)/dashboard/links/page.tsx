import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RenewButton from "./RenewButton";

type LinkItem = {
  placement: { status: string; expiresAt: Date | null; liveUrl: string | null } | null;
  id: string;
};

// Until when the placement's paid period runs; "Onbeperkt" for the ones
// from before periods existed.
function PeriodCell({ item }: { item: LinkItem }) {
  if (item.placement?.status === "expired") return <span className="text-red-600">Verlopen</span>;
  if (!item.placement?.expiresAt) return <span>Onbeperkt</span>;
  return <span>{item.placement.expiresAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}</span>;
}

function ActionsCell({ item }: { item: LinkItem }) {
  const live = item.placement?.status !== "expired";
  return (
    <div className="flex items-center justify-end gap-3">
      {live && item.placement?.liveUrl && (
        <a href={item.placement.liveUrl} target="_blank" rel="noreferrer" className="text-brand text-sm hover:underline">
          Bekijken
        </a>
      )}
      {item.placement?.status === "published" && item.placement.expiresAt && <RenewButton orderItemId={item.id} />}
    </div>
  );
}

export const metadata: Metadata = { title: "Links" };

export default async function CustomerLinksPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const items = await prisma.orderItem.findMany({
    where: { order: { customerId: session.user.id }, placement: { liveUrl: { not: null } } },
    include: { websiteProduct: { include: { website: true, product: true } }, placement: true, order: true },
    orderBy: { order: { createdAt: "desc" } },
  });

  const blogLinks = items.filter((i) => i.websiteProduct.product.type === "BLOG_POST");
  const homepageLinks = items.filter((i) => i.websiteProduct.product.type === "HOMEPAGE_LINK");

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Mijn links</h1>
      <p className="text-sm text-inkSoft mb-6">
        {items.filter((i) => i.placement?.status !== "expired").length} live plaatsing(en)
      </p>

      <section id="blog" className="mb-10 scroll-mt-4">
        <h2 className="font-serif text-lg text-ink mb-3">Blog links</h2>
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brandSoft/50 text-inkSoft text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Website</th>
                <th className="px-4 py-2 font-medium">Titel</th>
                <th className="px-4 py-2 font-medium">Ankertekst</th>
                <th className="px-4 py-2 font-medium">Doel-URL</th>
                <th className="px-4 py-2 font-medium">Live sinds</th>
                <th className="px-4 py-2 font-medium">Loopt tot</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {blogLinks.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink font-medium">{item.websiteProduct.website.domain}</td>
                  <td className="px-4 py-3 text-inkSoft truncate max-w-[220px]">{item.articleTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft">{item.anchorText ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft truncate max-w-[200px]">{item.targetUrl ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft">
                    {item.placement?.publishedAt?.toLocaleDateString("nl-NL") ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-inkSoft whitespace-nowrap">
                    <PeriodCell item={item} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionsCell item={item} />
                  </td>
                </tr>
              ))}
              {blogLinks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-inkSoft">
                    Nog geen live blog links.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="homepage" className="scroll-mt-4">
        <h2 className="font-serif text-lg text-ink mb-3">Homepage links</h2>
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brandSoft/50 text-inkSoft text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Website</th>
                <th className="px-4 py-2 font-medium">Rubriek</th>
                <th className="px-4 py-2 font-medium">Ankertekst</th>
                <th className="px-4 py-2 font-medium">Doel-URL</th>
                <th className="px-4 py-2 font-medium">Live sinds</th>
                <th className="px-4 py-2 font-medium">Loopt tot</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {homepageLinks.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink font-medium">{item.websiteProduct.website.domain}</td>
                  <td className="px-4 py-3 text-inkSoft">{item.wpCategoryNameSnap ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft">{item.anchorText ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft truncate max-w-[200px]">{item.targetUrl ?? "—"}</td>
                  <td className="px-4 py-3 text-inkSoft">
                    {item.placement?.publishedAt?.toLocaleDateString("nl-NL") ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-inkSoft whitespace-nowrap">
                    <PeriodCell item={item} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionsCell item={item} />
                  </td>
                </tr>
              ))}
              {homepageLinks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-inkSoft">
                    Nog geen live homepage links.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
