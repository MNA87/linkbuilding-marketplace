-- Eigen logo (data-URI) voor de app-shell; leeg = tekst-wordmark als fallback.
ALTER TABLE "SiteSettings" ADD COLUMN "logoDataUrl" TEXT NOT NULL DEFAULT '';
