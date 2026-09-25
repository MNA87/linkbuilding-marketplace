import { z } from "zod";
import { durationYearsSchema, publishOnField } from "@/lib/placementPeriod";
import { briefLinksSchema } from "@/lib/writingService";

// Google shows roughly the first 60-70 characters of a title in results.
export const TITLE_MAX_LENGTH = 70;

const orderContentBase = z.object({
  websiteProductId: z.string().cuid(),
  // No targetUrl/anchorText fields here — the customer places the whole
  // link themselves in the article text (select text, click the link
  // icon), so there's exactly one place the link's destination is set
  // instead of two that could disagree. Extracted/enforced server-side in
  // addToCartAction, not here.
  // Which WordPress category (on the target site) the article goes in —
  // optional since not every site has categories configured (see
  // WpCategory in schema.prisma).
  wpCategoryId: z.string().cuid().optional().or(z.literal("")),
  // Dofollow by default — nofollow is an explicit opt-in.
  nofollow: z.boolean().default(false),
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
  articleTitle: z
    .string()
    .trim()
    .max(TITLE_MAX_LENGTH, `Titel mag maximaal ${TITLE_MAX_LENGTH} tekens zijn`)
    .default(""),
  // HTML from the rich text editor — sanitized server-side in the action
  // before it's ever stored, so this only bounds raw input size. Must
  // contain real text (the editor's "empty" state is still "<p></p>").
  articleBody: z.string().trim().max(100000).default(""),
  // The key uploadArticleImage returns (see src/lib/upload.ts) — always a
  // randomUUID().ext, never anything supplied directly by the browser.
  articleImageKey: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i)
    .optional()
    .or(z.literal("")),
  // "Wanneer online?" ("" = direct) and "Periode" — see placementPeriod.ts.
  publishOn: publishOnField,
  durationYears: durationYearsSchema.default(1),
  // "Laat ons schrijven": no title/text from the customer, just their links.
  writeForMe: z.boolean().default(false),
  briefLinks: z.array(z.object({ anchor: z.string(), url: z.string() })).optional(),
});

// Either the customer's own article (title + text required), or the
// writing service (1-2 complete links required).
function checkContent(
  data: { writeForMe: boolean; briefLinks?: { anchor: string; url: string }[]; articleTitle: string; articleBody: string },
  ctx: z.RefinementCtx
) {
  if (data.writeForMe) {
    const links = briefLinksSchema.safeParse((data.briefLinks ?? []).filter((l) => l.anchor.trim() || l.url.trim()));
    if (!links.success) ctx.addIssue({ code: "custom", path: ["briefLinks"], message: links.error.issues[0]?.message ?? "Vul je link in" });
    return;
  }
  if (!data.articleTitle) ctx.addIssue({ code: "custom", path: ["articleTitle"], message: "Titel is verplicht" });
  if (data.articleBody.replace(/<[^>]*>/g, "").trim().length === 0) {
    ctx.addIssue({ code: "custom", path: ["articleBody"], message: "Tekst is verplicht" });
  }
}

export const createOrderSchema = orderContentBase.superRefine(checkContent);

export const updateOrderContentSchema = orderContentBase
  .omit({ websiteProductId: true })
  .extend({ orderItemId: z.string().cuid() })
  .superRefine(checkContent);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
