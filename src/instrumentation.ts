// Server + edge Sentry init, run once when the server starts. If
// SENTRY_DSN isn't set, the SDK is a no-op — safe to leave configured even
// before the env var exists.
import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });

    // The emergency restore (RESTORE_BACKUP in Railway) runs before the site
    // takes any requests; without the variable it does nothing.
    const { emergencyRestoreOnStartup } = await import("./lib/databaseBackup");
    await emergencyRestoreOnStartup();

    // Hourly background jobs (expiry reminders, planned publishes) in the
    // long-running server process. The global flag keeps a dev-server
    // reload from stacking up a second timer.
    const g = globalThis as typeof globalThis & { __nugevondenJobs?: boolean };
    if (!g.__nugevondenJobs) {
      g.__nugevondenJobs = true;
      const { runScheduledJobs } = await import("./lib/scheduledJobs");
      setTimeout(() => void runScheduledJobs(), 60_000);
      setInterval(() => void runScheduledJobs(), 60 * 60_000);
      // The "staat live" mails: every minute, one per round of links.
      const { sendLiveMails } = await import("./lib/liveMails");
      const { jobFailed, jobOk } = await import("./lib/systemAlerts");
      setInterval(
        () =>
          void sendLiveMails().then(
            () => jobOk('"Staat live"-mails'),
            (err) => jobFailed('"Staat live"-mails', err)
          ),
        60_000
      );
      // Orders by mail (Admin → Binnengekomen): the mailbox is read every
      // three minutes, with a mail to the admins about what came in; without
      // a mailbox set this does nothing.
      const { fetchInboundMail } = await import("./lib/mailbox");
      setInterval(
        // Its own failures are reported inside (Mail ophalen).
        () => void fetchInboundMail({ notify: true }).catch((err) => jobFailed("Mail ophalen", err)),
        3 * 60_000
      );
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

// An error on a page or in a form: to Sentry when set up, and a mail to
// the admins (src/lib/systemAlerts.ts: at most once per page per 6 hours).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { pageError } = await import("./lib/systemAlerts");
  await pageError(request.path.split("?")[0], err);
};
