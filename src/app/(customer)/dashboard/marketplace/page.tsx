import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { customerTerms, writingFeeFor } from "@/lib/customerPricing";
import { vatTreatment, vatNoteText } from "@/lib/vatRules";
import { scheduleBounds } from "@/lib/placementPeriod";
import BulkOrder, { type BulkSite, type BulkProject, type BulkCartItem } from "./BulkOrder";

export const metadata: Metadata = { title: "Marketplace" };

// The agency bulk-order flow: pick articles per site, assign each to a project
// (the agency's own client), and place them in one go — on account, onto the
// monthly verzamelfactuur. Only for a customer whose company has bulk-besteller
// turned on (Admin → Klanten → klant). See docs/nice-to-have/agency-module.md.
export default async function BulkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ prijzen?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");
  const { prijzen } = await searchParams;

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { bulkOrdering: true, country: true, isBusiness: true, vatNumber: true, vatStatus: true },
  });

  if (!company) redirect("/login");

  // Dezelfde flow voor iedereen. Een bureau (bulkOrdering) bestelt op rekening;
  // een reguliere klant rekent aan het eind direct af (Stripe · iDEAL/creditcard).
  const payMode = !company.bulkOrdering;

  const [projects, websites, topics, cartItems] = await Promise.all([
    prisma.project.findMany({
      where: { customerCompanyId: session.user.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true, product: { type: { in: ["BLOG_POST", "HOMEPAGE_LINK"] } } } } },
      include: {
        category: { select: { id: true, name: true } },
        niches: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        country: { select: { name: true, code: true } },
        language: { select: { name: true } },
        metrics: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: {
            domainRating: true,
            domainAuthority: true,
            trustFlow: true,
            citationFlow: true,
            organicTraffic: true,
            referringDomains: true,
            ipAddress: true,
            behindCloudflare: true,
            aiCited: true,
          },
        },
        websiteProducts: {
          where: { isAvailable: true, product: { type: { in: ["BLOG_POST", "HOMEPAGE_LINK"] } } },
          select: { id: true, config: true, periodic: true, product: { select: { type: true } } },
        },
      },
      orderBy: { domain: "asc" },
    }),
    prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // What this customer has already built up in the cart (the bulk order in
    // progress). The +/- on the list adds/removes these items so the top-bar
    // cart badge reacts; the order is finalised on account at "Bestellen".
    prisma.orderItem.findMany({
      where: { order: { customerId: session.user.id, status: "NEW" } },
      select: { id: true, websiteProductId: true, customerPriceSnap: true, draftContent: true },
    }),
  ]);

  // "Prijzen voor": Algemeen, or a chosen onderwerp (crypto, …) at that topic's
  // price. A site that doesn't place the chosen onderwerp drops out of the list.
  const selectedTopic = prijzen ? topics.find((t) => t.id === prijzen) ?? null : null;

  // Prices of sites already in the cart stay as snapshotted when they were
  // added — so switching "Prijzen voor" never silently reprices or hides a
  // site that's already in the bulk order.
  const cartSnapByWp = new Map<string, number>();
  for (const ci of cartItems) {
    if (!cartSnapByWp.has(ci.websiteProductId)) cartSnapByWp.set(ci.websiteProductId, Number(ci.customerPriceSnap));
  }

  // Build the orderable list, pricing each site for this customer and the chosen
  // onderwerp. A site whose price can't be determined for this onderwerp is left
  // out — unless it's already in the cart, where it's shown at its snapshot price.
  const sites: BulkSite[] = [];
  for (const w of websites) {
    const m = w.metrics[0];
    const niches = [w.category?.name, ...w.niches.filter((n) => n.id !== w.categoryId).map((n) => n.name)].filter(
      (n): n is string => Boolean(n)
    );
    // One orderable row per product (a domain can offer both a blog link and a
    // homepage link). The Type-filter in the UI shows one kind at a time, so a
    // domain never appears twice on screen.
    for (const wp of w.websiteProducts) {
      const kind = wp.product.type === "BLOG_POST" ? "blog" : "homepage";
      // Onderwerp-prijzen gelden alleen voor blog links; homepage links hebben
      // hun eigen (jaar)prijs, los van het gekozen onderwerp.
      const topicArg = kind === "blog" ? selectedTopic?.id ?? null : null;
      let price: number;
      // De standaardprijs (lijstprijs) voor deze klant/onderwerp — gelijk aan de
      // prijs als er geen korting is. Het verschil is de korting die we tonen.
      let listPrice: number;
      try {
        const pr = await computePriceForWebsiteProduct(wp.id, session.user.companyId, topicArg);
        price = Number(pr.customerPrice);
        listPrice = Number(pr.standardPrice);
      } catch {
        const snap = cartSnapByWp.get(wp.id);
        if (snap === undefined) continue;
        price = snap;
        listPrice = snap;
      }
      const config = wp.config as { maxLinks?: unknown };
      const maxLinks = w.maxLinks ?? (typeof config.maxLinks === "number" ? config.maxLinks : 1);
      sites.push({
        id: wp.id,
        kind,
        domain: w.domain,
        niche: w.category?.name ?? "—",
        niches,
        country: w.country?.name ?? "—",
        countryCode: w.country?.code ?? "",
        language: w.language?.name ?? "—",
        description: w.description ?? null,
        exampleUrl: w.exampleUrl ?? null,
        sponsored: w.sponsored,
        dr: m?.domainRating ?? null,
        da: m?.domainAuthority ?? null,
        trustFlow: m?.trustFlow ?? null,
        citationFlow: m?.citationFlow ?? null,
        traffic: m?.organicTraffic ?? null,
        referringDomains: m?.referringDomains ?? null,
        ipAddress: m?.ipAddress ?? null,
        behindCloudflare: m?.behindCloudflare ?? false,
        aiCited: m?.aiCited ?? null,
        maxLinks: Math.max(1, maxLinks),
        periodic: wp.periodic,
        price,
        listPrice,
      });
    }
  }

  // Korting-melding bovenin de marktplaats — alleen tonen als deze klant korting
  // heeft. De prijs per site blijft leidend (externe sites later tonen gewoon
  // hun eigen prijs zonder korting), dit is puur een rustige toelichting.
  const terms = await customerTerms(session.user.companyId);
  const discountBanner =
    terms.discountPercent && terms.discountPercent.gt(0)
      ? `Je hebt ${terms.discountPercent.toNumber()}% korting op onze sites — al verrekend in de prijzen.`
      : terms.fixed.size > 0
        ? "Jouw afgesproken tarieven zijn al verrekend in de prijzen."
        : null;

  // "Laat ons schrijven" costs this on top of the placement (0 when writing is
  // included in this customer's terms).
  const writingFee = (await writingFeeFor(session.user.companyId)).toNumber();

  // BTW-behandeling voor de totalen op "Bevestigen" (21% NL, of 0% met een
  // "btw verlegd"/buiten-EU-notitie).
  const vat = vatTreatment(company);
  const vatRate = vat.rate;
  const vatNote = vatNoteText(vat.note);

  const projectList: BulkProject[] = projects.map((p) => ({ id: p.id, name: p.name }));

  // Only cart items whose site is in the orderable list — anything else can't be
  // shown or finalised meaningfully (e.g. a site that went offline).
  const siteIds = new Set(sites.map((s) => s.id));
  const initialCart: BulkCartItem[] = cartItems
    .filter((ci) => siteIds.has(ci.websiteProductId))
    .map((ci) => ({
      orderItemId: ci.id,
      websiteProductId: ci.websiteProductId,
      draft: (ci.draftContent as BulkCartItem["draft"]) ?? null,
    }));

  return (
    <BulkOrder
      sites={sites}
      projects={projectList}
      schedule={scheduleBounds()}
      topics={topics}
      topicId={selectedTopic?.id ?? ""}
      writingFee={writingFee}
      vatRate={vatRate}
      vatNote={vatNote}
      initialCart={initialCart}
      payMode={payMode}
      discountBanner={discountBanner}
    />
  );
}
