const rateMap = new Map<string, { count: number; reset: number }>();

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60000
): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, reset: entry.reset };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, reset: entry.reset };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now > entry.reset) {
      rateMap.delete(key);
    }
  }
}, 60000);
