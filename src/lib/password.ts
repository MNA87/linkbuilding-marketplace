import { hash, verify } from "@node-rs/bcrypt";

// bcrypt in native code on Node's worker threads, not in JavaScript on the
// main thread: with bcryptjs one login held the whole site up for ~0.3s, so
// 100 people logging in at once froze every page for half a minute. Reads
// the $2a$ hashes bcryptjs wrote, so existing passwords keep working.
const COST = 12;

// Those worker threads also read the files every page is served from, so a
// rush of logins may only ever take some of them — the rest wait their turn
// here, and pages keep loading in the meantime.
const THREADS = Number(process.env.UV_THREADPOOL_SIZE) || 4;
const MAX_AT_ONCE = Math.max(1, Math.floor(THREADS / 2));
let running = 0;
const waiting: (() => void)[] = [];

async function oneAtATurn<T>(work: () => Promise<T>): Promise<T> {
  // A finished turn hands its place straight to the next in line.
  if (running >= MAX_AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve));
  else running++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

export function hashPassword(password: string): Promise<string> {
  return oneAtATurn(() => hash(password, COST));
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return oneAtATurn(() => verify(password, passwordHash));
}
