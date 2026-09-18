import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const PLUGIN_PATH = path.join(process.cwd(), "wordpress-plugin", "nugevonden-wp-sync.php");

// WordPress core only checks wordpress.org for plugin updates — this one
// isn't published there, so it polls this endpoint itself (see
// pre_set_site_transient_update_plugins in the plugin) to show the normal
// "Update available" banner in wp-admin. That's what makes shipping a new
// plugin version a one-click "Update now" instead of re-uploading the file.
export async function GET(req: Request) {
  const source = fs.readFileSync(PLUGIN_PATH, "utf8");
  const version = source.match(/Version:\s*([\d.]+)/)?.[1] ?? "0.0.0";

  const baseUrl = (process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");

  return NextResponse.json({
    name: "Nugevonden WP Sync",
    slug: "nugevonden-wp-sync",
    version,
    download_url: `${baseUrl}/api/wp-sync/plugin/download`,
    requires: "5.8",
    tested: "6.7",
    sections: {
      description:
        "Haalt betaalde Nugevonden-orders zelf op en plaatst ze in WordPress. Wordt vanaf hier automatisch bijgewerkt.",
    },
  });
}
