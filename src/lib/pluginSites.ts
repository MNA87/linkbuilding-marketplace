import { prisma } from "@/lib/prisma";
import { wpSyncSecretOf } from "@/lib/wpSyncSecret";
import { domainFromUserAgent, reportedVersion } from "@/lib/pluginReleases";

type Site = { id: string; pluginTestSite: boolean; wpPluginVersion: string | null; wpPluginSeenAt: Date | null };
const select = { id: true, pluginTestSite: true, wpPluginVersion: true, wpPluginSeenAt: true } as const;

// Which site asks for a plugin update: by its secret (since 1.15.1), else by
// the site address WordPress puts in its User-Agent.
export async function siteOfPluginRequest(req: Request): Promise<Site | null> {
  const { secret } = wpSyncSecretOf(req);
  if (secret) {
    const site = await prisma.website.findUnique({ where: { wpSyncSecret: secret }, select });
    if (site) return site;
  }
  const domain = domainFromUserAgent(req.headers.get("user-agent"));
  if (!domain) return null;
  return prisma.website.findFirst({ where: { domain: { in: [domain, `www.${domain}`] } }, select });
}

// Notes the version a site says it runs (Instellingen → Systeem), at most
// every 10 minutes unless it changed.
export async function notePluginVersion(site: Site | null, req: Request): Promise<void> {
  const version = reportedVersion(req);
  if (!site || !version) return;
  const fresh = site.wpPluginSeenAt && Date.now() - site.wpPluginSeenAt.getTime() < 10 * 60_000;
  if (site.wpPluginVersion === version && fresh) return;
  await prisma.website
    .update({ where: { id: site.id }, data: { wpPluginVersion: version, wpPluginSeenAt: new Date() } })
    .catch(() => {});
}
