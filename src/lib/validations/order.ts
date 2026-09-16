import { z } from "zod";

export const createOrderSchema = z.object({
  websiteProductId: z.string().cuid(),
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
  articleTitle: z.string().trim().min(1, "Titel is verplicht").max(300),
  // HTML from the rich text editor — sanitized server-side in the action
  // before it's ever stored, so this only bounds raw input size. Must
  // contain real text (the editor's "empty" state is still "<p></p>").
  articleBody: z
    .string()
    .trim()
    .max(40000)
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length > 0, "Tekst is verplicht"),
  uploadedFileUrl: z.string().max(500).optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
