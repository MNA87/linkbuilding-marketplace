import { z } from "zod";

export const createOrderSchema = z
  .object({
    websiteProductId: z.string().cuid(),
    projectId: z.string().cuid().optional(),
    newProjectName: z.string().trim().min(2).max(200).optional(),
    targetUrl: z.string().trim().url("Vul een geldige URL in").max(2000),
    anchorText: z.string().trim().min(1, "Ankertekst is verplicht").max(200),
    comments: z.string().trim().max(2000).optional().or(z.literal("")),
    contentSource: z.enum(["CUSTOMER", "PUBLISHER"]),
    articleTitle: z.string().trim().max(300).optional().or(z.literal("")),
    articleBody: z.string().trim().max(20000).optional().or(z.literal("")),
    uploadedFileUrl: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((data) => data.projectId || data.newProjectName, {
    message: "Kies een project of geef een naam voor een nieuw project",
    path: ["newProjectName"],
  })
  .refine(
    (data) => data.contentSource !== "CUSTOMER" || (data.articleTitle && data.articleBody),
    {
      message: "Titel en tekst zijn verplicht als jij de content aanlevert",
      path: ["articleBody"],
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
