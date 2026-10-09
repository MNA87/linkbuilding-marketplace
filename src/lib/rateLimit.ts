// In-memory sliding-window rate limiter. Good enough for a single Railway
// instance; if the app ever scales to multiple instances, swap the Map for
// a shared store (e.g. Upstash Redis) since counters would otherwise be
// per-instance instead of global.
// Each key keeps its own window, so the clean-up below drops only what's
// past that window (a 15-minute limit lasts 15 minutes, not one).
const attempts = new Map<string, { windowMs: number; timestamps: number[] }>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

// Periodically drop stale keys so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  Array.from(attempts.entries()).forEach(([key, entry]) => {
    const fresh = entry.timestamps.filter((t: number) => t > now - entry.windowMs);
    if (fresh.length === 0) attempts.delete(key);
    else attempts.set(key, { ...entry, timestamps: fresh });
  });
}, WINDOW_MS).unref?.();

export function isRateLimited(key: string, maxAttempts = MAX_ATTEMPTS, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (attempts.get(key)?.timestamps ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= maxAttempts) {
    attempts.set(key, { windowMs, timestamps });
    return true;
  }

  timestamps.push(now);
  attempts.set(key, { windowMs, timestamps });
  return false;
}
