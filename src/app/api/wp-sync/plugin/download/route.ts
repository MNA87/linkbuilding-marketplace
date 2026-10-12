import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { latestVersion, releaseSource, versionForSite } from "@/lib/pluginReleases";
import { siteOfPluginRequest } from "@/lib/pluginSites";

// Packaged in its own folder named after the plugin slug, exactly like a
// wordpress.org plugin — that's the layout WordPress' built-in "Update now"
// button expects when it replaces an installed plugin in place.
// ?version= picks a kept version (wordpress-plugin/releases/); without it,
// the one this site is due (src/lib/pluginReleases.ts).
export async function GET(req: Request) {
  let version = new URL(req.url).searchParams.get("version");
  if (!version) {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { pluginReleasedVersion: true },
    });
    version = versionForSite(await siteOfPluginRequest(req), settings?.pluginReleasedVersion ?? null, latestVersion());
  }
  const source = releaseSource(version);
  if (!source) return NextResponse.json({ error: "Onbekende versie." }, { status: 404 });
  const zip = new JSZip();
  zip.file("nugevonden-wp-sync/nugevonden-wp-sync.php", source);
  const buffer = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="nugevonden-wp-sync-${version}.zip"`,
    },
  });
}
