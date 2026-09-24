// Server + edge Sentry init, run once when the server starts. If
// SENTRY_DSN isn't set, the SDK is a no-op — safe to leave configured even
// before the env var exists.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });

    // Hourly background jobs (expiry reminders, planned publishes) in the
    // long-running server process. The global flag keeps a dev-server
    // reload from stacking up a second timer.
    const g = globalThis as typeof globalThis & { __nugevondenJobs?: boolean };
    if (!g.__nugevondenJobs) {
      g.__nugevondenJobs = true;
      const { runScheduledJobs } = await import("./lib/scheduledJobs");
      setTimeout(() => void runScheduledJobs(), 60_000);
      setInterval(() => void runScheduledJobs(), 60 * 60_000);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
