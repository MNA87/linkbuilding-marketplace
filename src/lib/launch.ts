// Admin → Planning: the points to finish before going live, in four steps,
// the ideas for afterwards (Nice to have) and your own to-dos (Algemeen). The
// points themselves are rows of LaunchItem; the steps are fixed here.

export const LAUNCH_STEPS = [
  { step: 1, title: "Juridisch en bedrijf" },
  { step: 2, title: "Betalen en e-mail" },
  { step: 3, title: "Opruimen en websites" },
  { step: 4, title: "Veiligheid en controle" },
] as const;

export type LaunchStatus = "todo" | "busy" | "done" | "skip";

// One tap on the circle moves a point on: te doen → bezig → klaar → te doen.
// "Laten zo" starts over at te doen.
export function nextStatus(status: string): LaunchStatus {
  if (status === "todo") return "busy";
  if (status === "busy") return "done";
  return "todo";
}

// How far along the livegang is: a point that's done counts fully, one
// that's busy for half, and "laten zo" not at all.
export function launchPercent(items: { status: string }[]): number {
  const counted = items.filter((i) => i.status !== "skip");
  if (counted.length === 0) return 0;
  const score = counted.reduce((sum, i) => sum + (i.status === "done" ? 1 : i.status === "busy" ? 0.5 : 0), 0);
  return Math.round((score / counted.length) * 100);
}

// The step that's being worked on: the first one with something still open.
export function currentStep(items: { step: number; status: string }[]): number | null {
  const open = LAUNCH_STEPS.find((s) => items.some((i) => i.step === s.step && (i.status === "todo" || i.status === "busy")));
  return open?.step ?? null;
}
