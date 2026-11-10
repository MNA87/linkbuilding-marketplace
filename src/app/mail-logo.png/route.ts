import { MAIL_LOGO_PNG_BASE64 } from "@/lib/brand/mailLogo";

// Vast adres voor het logo bovenin elke e-mail (src/lib/emailLayout.ts).
const png = Buffer.from(MAIL_LOGO_PNG_BASE64, "base64");

export function GET() {
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.length),
      "Cache-Control": "public, max-age=604800",
    },
  });
}
