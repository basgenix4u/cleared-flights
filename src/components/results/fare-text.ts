import { fmtMoney } from "@/lib/format";
import type { Fare } from "@/lib/types";

/** Plain-language fare rules. Pure functions so both server and client components can use them. */
export function bagText(f: Fare) {
  const c = f.baggage.checked;
  if (c === null) return { tone: "maybe" as const, text: "Checked bag not stated" };
  if (c === 0) return { tone: "no" as const, text: "No checked bag" };
  return { tone: "yes" as const, text: `${c} checked bag${c > 1 ? "s" : ""}${f.baggage.checkedKg ? ` · ${f.baggage.checkedKg} kg` : ""}` };
}
export function cabinText(f: Fare) {
  const c = f.baggage.cabin;
  if (c === null) return { tone: "maybe" as const, text: "Cabin bag not stated" };
  if (c === 0) return { tone: "no" as const, text: "No cabin bag" };
  return { tone: "yes" as const, text: `${c} cabin bag${c > 1 ? "s" : ""}` };
}
export function refundText(f: Fare) {
  const { allowed, fee } = f.conditions.refund;
  const cur = f.price.currency;
  if (allowed === null) return { tone: "maybe" as const, text: "Refund rules not stated" };
  if (!allowed) return { tone: "no" as const, text: "Non-refundable" };
  return { tone: "yes" as const, text: fee ? `Refundable · ${fmtMoney(fee, cur)} fee` : "Refundable" };
}
export function changeText(f: Fare) {
  const { allowed, fee } = f.conditions.change;
  const cur = f.price.currency;
  if (allowed === null) return { tone: "maybe" as const, text: "Change rules not stated" };
  if (!allowed) return { tone: "no" as const, text: "No changes" };
  return { tone: "yes" as const, text: fee ? `Change fee ${fmtMoney(fee, cur)}` : "Free to change" };
}
export function seatText(f: Fare) {
  const s = f.conditions.seat;
  return s === "free" ? { tone: "yes" as const, text: "Seat choice included" } : s === "paid" ? { tone: "no" as const, text: "Seat choice for a fee" } : s === "at_checkin" ? { tone: "maybe" as const, text: "Seat at check-in" } : { tone: "maybe" as const, text: "Seat rules not stated" };
}

