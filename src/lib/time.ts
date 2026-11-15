/** Time-zone helpers built on Intl (no dependencies). Local strings are 'YYYY-MM-DDTHH:mm'. */
const cache = new Map<string, Intl.DateTimeFormat>();

function dtf(tz: string) {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    cache.set(tz, f);
  }
  return f;
}

export function tzOffsetMin(tz: string, utcMs: number): number {
  const parts: Record<string, string> = {};
  for (const p of dtf(tz).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

export function localToUtcMs(local: string, tz: string): number {
  const [d, t] = local.split("T");
  const [y, m, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, da, h, mi);
  let guess = asUtc - tzOffsetMin(tz, asUtc) * 60000;
  guess = asUtc - tzOffsetMin(tz, guess) * 60000;
  return guess;
}

export function utcMsToLocal(ms: number, tz: string): string {
  const parts: Record<string, string> = {};
  for (const p of dtf(tz).formatToParts(new Date(ms))) parts[p.type] = p.value;
  const hh = String(+parts.hour % 24).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}`;
}

/** Parse ISO-8601 duration like PT7H5M / P0DT12H30M into minutes. */
export function isoDurationToMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}
