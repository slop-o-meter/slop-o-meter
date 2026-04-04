import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

interface WindowEntry {
  timestamps: number[];
}

export default function rateLimiter({
  windowMs,
  maxRequests,
}: RateLimiterOptions) {
  const windows = new Map<string, WindowEntry>();

  // Periodically clean up stale entries to prevent memory leaks
  const CLEANUP_INTERVAL_MS = 60_000;
  let lastCleanup = Date.now();

  function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
      return;
    }
    lastCleanup = now;
    for (const [ip, entry] of windows) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        windows.delete(ip);
      }
    }
  }

  return async (context: Context, next: Next) => {
    const clientIp = getClientIp(context);
    const now = Date.now();

    cleanup(now);

    let entry = windows.get(clientIp);
    if (!entry) {
      entry = { timestamps: [] };
      windows.set(clientIp, entry);
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= maxRequests) {
      throw new HTTPException(429, { message: "Too many requests" });
    }

    entry.timestamps.push(now);
    await next();
  };
}

function getClientIp(context: Context): string {
  // CloudFront forwards the real client IP in these headers
  const forwarded = context.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return context.req.header("x-real-ip") ?? "unknown";
}
