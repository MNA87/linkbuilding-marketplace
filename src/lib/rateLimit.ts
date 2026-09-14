// In-memory sliding-window rate limiter. Good enough for a single Railway
// instance; if the app ever scales to multiple instances, swap the Map for
// a shared store (e.g. Upstash Redis) since counters would otherwise be
// per-instance instead of global.
const attempts = new Map<string, number[]>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

// Periodically drop stale keys so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  Array.from(attempts.entries()).forEach(([key, timestamps]) => {
    const fresh = timestamps.filter((t: number) => t > cutoff);
    if (fresh.length === 0) attempts.delete(key);
    else attempts.set(key, fresh);
  });
}, WINDOW_MS).unref?.();

export function isRateLimited(key: string, maxAttempts = MAX_ATTEMPTS, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (attempts.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= maxAttempts) {
    attempts.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return false;
}
