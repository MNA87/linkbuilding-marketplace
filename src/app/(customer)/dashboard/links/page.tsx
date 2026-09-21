import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      <p className="text-sm text-inkSoft mb-6">{items.length} live plaatsing(en)</p>

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
                  <td className="px-4 py-3 text-right">
                    {item.placement?.liveUrl && (
                      <a
                        href={item.placement.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand text-sm hover:underline"
                      >
                        Bekijken
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {blogLinks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
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
                  <td className="px-4 py-3 text-right">
                    {item.placement?.liveUrl && (
                      <a
                        href={item.placement.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand text-sm hover:underline"
                      >
                        Bekijken
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {homepageLinks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
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
