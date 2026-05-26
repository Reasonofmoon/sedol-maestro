// ── Simple in-memory rate limiter ────────────────────────────
// 5 analyses per IP per hour (free tier protection)

interface Record { count: number; resetAt: number; }
const store = new Map<string, Record>();

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const WINDOW = 60 * 60 * 1000; // 1 hour
  const LIMIT = 10;

  const rec = store.get(ip);
  if (!rec || now > rec.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW });
    return { allowed: true, remaining: LIMIT - 1, resetInMs: WINDOW };
  }

  if (rec.count >= LIMIT) {
    return { allowed: false, remaining: 0, resetInMs: rec.resetAt - now };
  }

  rec.count++;
  return { allowed: true, remaining: LIMIT - rec.count, resetInMs: rec.resetAt - now };
}

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of store) {
    if (now > rec.resetAt) store.delete(ip);
  }
}, 60 * 60 * 1000);
