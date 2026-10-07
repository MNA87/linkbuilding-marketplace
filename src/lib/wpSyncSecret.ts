// How a site's WordPress plugin proves which site it is: its wpSyncSecret,
// in a request header since plugin 1.15.0, so it stays out of URLs (and so
// out of server and proxy logs). Older plugins still send it in the URL
// (?secret=); that keeps working until every site has updated.
export const WP_SYNC_SECRET_HEADER = "x-nugevonden-secret";

export function wpSyncSecretOf(req: Request): { secret: string | null; inUrl: boolean } {
  const header = req.headers.get(WP_SYNC_SECRET_HEADER);
  if (header) return { secret: header, inUrl: false };
  const query = new URL(req.url).searchParams.get("secret");
  return { secret: query, inUrl: Boolean(query) };
}
