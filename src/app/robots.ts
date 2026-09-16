import type { MetadataRoute } from "next";
import { getNoindexEnabled } from "@/lib/siteSettings";

// Same reasoning as the layout: without this, /robots.txt is generated once
// at build time (when the database isn't reachable) instead of per request.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const noindexEnabled = await getNoindexEnabled();
  return {
    rules: { userAgent: "*", disallow: noindexEnabled ? "/" : [] },
  };
}
