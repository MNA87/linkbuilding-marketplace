import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const PLUGIN_PATH = path.join(process.cwd(), "wordpress-plugin", "nugevonden-wp-sync.php");

// Packaged in its own folder named after the plugin slug, exactly like a
// wordpress.org plugin — that's the layout WordPress' built-in "Update now"
// button expects when it replaces an installed plugin in place.
export async function GET() {
  const source = fs.readFileSync(PLUGIN_PATH);
  const zip = new JSZip();
  zip.file("nugevonden-wp-sync/nugevonden-wp-sync.php", source);
  const buffer = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="nugevonden-wp-sync.zip"',
    },
  });
}
