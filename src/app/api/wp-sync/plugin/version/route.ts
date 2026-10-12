import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { latestVersion, versionForSite } from "@/lib/pluginReleases";
import { notePluginVersion, siteOfPluginRequest } from "@/lib/pluginSites";

// WordPress core only checks wordpress.org for plugin updates — this one
// isn't published there, so it polls this endpoint itself (see
// pre_set_site_transient_update_plugins in the plugin) to show the normal
// "Update available" banner in wp-admin. That's what makes shipping a new
// plugin version a one-click "Update now" instead of re-uploading the file.
//
// Not every site gets the newest version: see src/lib/pluginReleases.ts.
export async function GET(req: Request) {
  const site = await siteOfPluginRequest(req);
  await notePluginVersion(site, req);
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { pluginReleasedVersion: true } });
  const version = versionForSite(site, settings?.pluginReleasedVersion ?? null, latestVersion());

  const baseUrl = (process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");

  return NextResponse.json({
    name: "Nugevonden WP Sync",
    slug: "nugevonden-wp-sync",
    version,
    download_url: `${baseUrl}/api/wp-sync/plugin/download?version=${version}`,
    requires: "5.8",
    requires_php: "7.4",
    tested: "6.7",
    sections: {
      description:
        "Haalt betaalde Nugevonden-orders zelf op en plaatst ze in WordPress. Wordt vanaf hier automatisch bijgewerkt.",
    },
  });
}
