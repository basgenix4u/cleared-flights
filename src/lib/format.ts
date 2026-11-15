/** Client-safe, deterministic formatting (fixed locales so SSR and client always agree). */
export function fmtMoney(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtMoneyWhole(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export const timeOf = (local: string) => local.slice(11, 16);
export const dateOf = (local: string) => local.slice(0, 10);

function utcFromDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dayDelta(fromLocal: string, toLocal: string): number {
  return Math.round((utcFromDate(toLocal) - utcFromDate(fromLocal)) / 86400000);
}

export function addDays(date: string, n: number): string {
  return new Date(utcFromDate(date) + n * 86400000).toISOString().slice(0, 10);
}

export function fmtDay(
  date: string,
  style: "short" | "long" | "weekday" | "month" = "short",
): string {
  const d = new Date(utcFromDate(date));
  const opt: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "weekday"
        ? { weekday: "short" }
        : style === "month"
          ? { month: "long", year: "numeric" }
          : { weekday: "short", day: "numeric", month: "short" };
  return d.toLocaleDateString("en-GB", { ...opt, timeZone: "UTC" });
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmtDateTimeUtc(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " UTC";
}

export const CABIN_LABEL: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function stopsLabel(stops: number) {
  return stops === 0 ? "Nonstop" : stops === 1 ? "1 stop" : `${stops} stops`;
}

export function countryName(cc: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}
