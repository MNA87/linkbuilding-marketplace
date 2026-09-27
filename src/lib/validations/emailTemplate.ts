import { z } from "zod";

export const setEmailTemplateSchema = z.object({
  key: z.enum(["verification", "password_reset", "order_confirmation", "new_order_notification", "order_published", "placement_expiring", "content_reminder", "email_change", "email_changed"]),
  subject: z.string().trim().min(1, "Onderwerp is verplicht").max(300),
  bodyHtml: z.string().trim().min(1, "Inhoud is verplicht").max(20000),
});
