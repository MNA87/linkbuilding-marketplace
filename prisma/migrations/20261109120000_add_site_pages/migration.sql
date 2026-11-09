-- CMS van de publieke site: per pagina alleen de afwijkingen van de standaardteksten in code.
CREATE TABLE "SitePage" (
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "content" JSONB,
    "draft" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("slug")
);
