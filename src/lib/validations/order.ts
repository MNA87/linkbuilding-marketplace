import { z } from "zod";

export const createOrderSchema = z.object({
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
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
  articleTitle: z.string().trim().min(1, "Titel is verplicht").max(300),
  // HTML from the rich text editor — sanitized server-side in the action
  // before it's ever stored, so this only bounds raw input size. Must
  // contain real text (the editor's "empty" state is still "<p></p>").
  articleBody: z
    .string()
    .trim()
    .max(100000)
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length > 0, "Tekst is verplicht"),
  // The key uploadArticleImage returns (see src/lib/upload.ts) — always a
  // randomUUID().ext, never anything supplied directly by the browser.
  articleImageKey: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i)
    .optional()
    .or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
