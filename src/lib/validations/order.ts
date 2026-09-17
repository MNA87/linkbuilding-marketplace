import { z } from "zod";

export const createOrderSchema = z.object({
  websiteProductId: z.string().cuid(),
  targetUrl: z.string().trim().url("Vul een geldige URL in, bijv. https://jouwsite.nl/pagina"),
  // The ankertekst (visible link text) is set by the customer themselves in
  // the article text — select a bit of text and click the link icon, then
  // paste the target URL above. No separate field for it: that would be a
  // second place the link could point somewhere else than what's typed
  // here. Enforced/derived server-side in addToCartAction, not here.
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
