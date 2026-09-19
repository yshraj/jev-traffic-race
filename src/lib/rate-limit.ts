type Bucket = number[];

const hits = new Map<string, Bucket>();

export function allowRun(
  ip: string,
  limit = 10,
  windowMs = 10 * 60 * 1000,
): boolean {
  const now = Date.now();
  const prior = (hits.get(ip) ?? []).filter((stamp) => now - stamp < windowMs);
  if (prior.length >= limit) {
    hits.set(ip, prior);
    return false;
  }
  prior.push(now);
  hits.set(ip, prior);
  return true;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  return headers.get("x-real-ip") ?? "local";
}
