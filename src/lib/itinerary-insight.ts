import type { Fare, Itinerary, Layover, Slice } from "./types";

/**
 * Trip insight: a deterministic read on what can go wrong with an itinerary, derived
 * only from data the search already returns — no extra provider calls, no ML, no
 * guesswork presented as fact.
 *
 * The point is to answer the questions a traveller actually asks after they have
 * seen the price, and that every OTA defers until after payment:
 *   "Is this connection safe?" "What does it cost me to change my mind?"
 *   "Will my bag follow me?" "Do I land at a bad hour?"
 *
 * Everything here is explainable: each score contribution has a sentence attached.
 */

export type Tone = "good" | "warn" | "bad" | "info";

export interface Factor {
  id: string;
  label: string;
  detail: string;
  tone: Tone;
  /** Points removed from the 0–100 clock. Informational factors remove none. */
  penalty: number;
}

export interface RiskProfile {
  score: number;
  band: "low" | "moderate" | "elevated" | "high";
  headline: string;
  factors: Factor[];
}

const CARRIER_CHANGE_PENALTY = 14;
const AIRPORT_CHANGE_PENALTY = 26;
const TIGHT_CONNECTION_PENALTY = 30;
const SHORT_CONNECTION_PENALTY = 10;
const OVERNIGHT_PENALTY = 12;
const LATE_ARRIVAL_PENALTY = 8;
const RED_EYE_PENALTY = 4;
const NONSTOP_BONUS = 0;
const NON_REFUNDABLE_PENALTY = 6;

const hourOf = (local: string) => Number(local.slice(11, 13));
const isLateArrival = (local: string) => hourOf(local) >= 23 || hourOf(local) <= 4;
const isRedEye = (local: string) => hourOf(local) < 6;

/**
 * Minimum connection time, approximated from what we know: international-to-
 * international transfers need immigration and a terminal change, domestic does not,
 * and any airport change needs a taxi plus a second security queue.
 */
export function requiredConnectionMin(slice: Slice, index: number): number {
  const l = slice.layovers[index];
  if (!l) return 0;
  if (l.flags.includes("airport_change")) return 240;
  const inbound = slice.segments[index];
  const outbound = slice.segments[index + 1];
  const international = inbound && outbound ? inbound.origin.cc !== outbound.destination.cc || inbound.origin.cc !== l.airport.cc : false;
  return international ? 105 : 60;
}

export function connectionRisk(slice: Slice): { tight: Layover[]; short: Layover[]; atRisk: boolean } {
  const tight: Layover[] = [];
  const short: Layover[] = [];
  slice.layovers.forEach((l, i) => {
    const need = requiredConnectionMin(slice, i);
    if (l.durationMin < need) tight.push(l);
    else if (l.durationMin < need + 45) short.push(l);
  });
  return { tight, short, atRisk: tight.length > 0 };
}

const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm ? `${mm}m` : ""}`.trim() : `${mm}m`;
};

/** Does the whole journey look like separately-ticketed segments (self-transfer)? */
function looksSelfTransfer(it: Itinerary): boolean {
  return it.slices.some((s) => new Set(s.segments.map((seg) => seg.operatingCarrier.code)).size > 1);
}

export function riskProfile(it: Itinerary, fare: Fare): RiskProfile {
  const factors: Factor[] = [];
  let score = 100;

  const tight = it.slices.flatMap((s) => connectionRisk(s).tight);
  const short = it.slices.flatMap((s) => connectionRisk(s).short);

  if (tight.length) {
    score -= TIGHT_CONNECTION_PENALTY;
    factors.push({
      id: "connection-tight",
      label: "Connection below minimum",
      detail: `${tight.map((l) => `${l.airport.code} at ${fmt(l.durationMin)}`).join(", ")} — under the usual minimum for that transfer. A delay on the first flight puts the rest at risk.`,
      tone: "bad",
      penalty: TIGHT_CONNECTION_PENALTY,
    });
  }
  if (short.length) {
    score -= SHORT_CONNECTION_PENALTY;
    factors.push({
      id: "connection-short",
      label: "Tight but legal connection",
      detail: `${short.map((l) => `${l.airport.code} at ${fmt(l.durationMin)}`).join(", ")} — allowed, with little slack for a late arrival.`,
      tone: "warn",
      penalty: SHORT_CONNECTION_PENALTY,
    });
  }

  const airportChanges = it.slices.flatMap((s) => s.layovers.filter((l) => l.flags.includes("airport_change")));
  if (airportChanges.length) {
    score -= AIRPORT_CHANGE_PENALTY;
    factors.push({
      id: "airport-change",
      label: `Change of airport in ${airportChanges.map((l) => l.airport.city).join(", ")}`,
      detail: "You must clear immigration, collect your bag and travel to a different airport. Allow four hours and check visa requirements for the transit country.",
      tone: "bad",
      penalty: AIRPORT_CHANGE_PENALTY,
    });
  }

  const overnight = it.slices.flatMap((s) => s.layovers.filter((l) => l.flags.includes("overnight")));
  if (overnight.length) {
    score -= OVERNIGHT_PENALTY;
    factors.push({
      id: "overnight",
      label: "Overnight layover",
      detail: `${overnight.map((l) => l.airport.code).join(", ")} — meals and a hotel are normally at your own cost unless the airline provides a transit hotel.`,
      tone: "warn",
      penalty: OVERNIGHT_PENALTY,
    });
  }

  if (looksSelfTransfer(it)) {
    score -= CARRIER_CHANGE_PENALTY;
    factors.push({
      id: "self-transfer",
      label: "More than one operating airline",
      detail: "You are likely to re-check bags and possibly re-clear security between flights. If one leg is delayed, the other airline is not obliged to rebook you.",
      tone: "warn",
      penalty: CARRIER_CHANGE_PENALTY,
    });
  }

  const lateArrivals = it.slices.filter((s) => isLateArrival(s.arriveLocal));
  if (lateArrivals.length) {
    score -= LATE_ARRIVAL_PENALTY;
    factors.push({
      id: "late-arrival",
      label: "Arrives late at night",
      detail: `${lateArrivals.map((s) => `${s.destination.code} at ${s.arriveLocal.slice(11, 16)}`).join(", ")} — airport transfers are thinner and some hotels do not hold a room past midnight.`,
      tone: "warn",
      penalty: LATE_ARRIVAL_PENALTY,
    });
  }

  const firstDeparture = it.slices[0]?.departLocal ?? "";
  if (isRedEye(firstDeparture)) {
    score -= RED_EYE_PENALTY;
    factors.push({
      id: "red-eye",
      label: "Very early departure",
      detail: `${firstDeparture.slice(11, 16)} departure — check-in usually closes an hour earlier and public transport may not run.`,
      tone: "info",
      penalty: RED_EYE_PENALTY,
    });
  }

  const refundable = fare.conditions.refund.allowed === true;
  if (!refundable) {
    score -= NON_REFUNDABLE_PENALTY;
  }

  if (it.stops === 0) {
    factors.push({
      id: "nonstop",
      label: "Nonstop",
      detail: "No connections: the single strongest protection against a disrupted journey.",
      tone: "good",
      penalty: NONSTOP_BONUS,
    });
  }

  if (refundable) {
    factors.push({
      id: "refundable",
      label: "Refundable fare",
      detail: fare.conditions.refund.fee ? `Refundable, with a ${fare.conditions.refund.fee} fee.` : "Refundable as supplied by the airline.",
      tone: "good",
      penalty: 0,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const band: RiskProfile["band"] = score >= 85 ? "low" : score >= 68 ? "moderate" : score >= 48 ? "elevated" : "high";
  const headline =
    band === "low"
      ? "Straightforward journey"
      : band === "moderate"
        ? "One thing to watch"
        : band === "elevated"
          ? "Needs attention before you book"
          : "Fragile itinerary";

  // Highest-impact factors first, so the card shows what matters.
  factors.sort((a, b) => b.penalty - a.penalty);
  return { score, band, headline, factors };
}

/* ------------------------------------------------------------------ */
/* Money: what changing your mind actually costs                        */
/* ------------------------------------------------------------------ */

export interface Flexibility {
  changeAllowed: boolean | null;
  changeFee: number | null;
  refundAllowed: boolean | null;
  refundFee: number | null;
  /** Worst case: the amount you cannot get back if you cancel (null = unknown). */
  atRisk: number | null;
  changeText: string;
  cancelText: string;
  tone: Tone;
}

/**
 * Converts airline rules into the only form a customer cares about: money.
 * "Non-refundable" is a rule; "you lose the whole fare" is information.
 */
export function flexibility(fare: Fare): Flexibility {
  const total = fare.price.total;
  const change = fare.conditions.change;
  const refund = fare.conditions.refund;

  const atRisk = refund.allowed === true ? Math.min(total, refund.fee ?? 0) : refund.allowed === false ? total : null;

  const changeText =
    change.allowed === false
      ? "Changes not permitted"
      : change.allowed === true
        ? change.fee === 0 || change.fee === null
          ? "Changes free (fare difference may apply)"
          : `Change for ${change.fee} ${fare.price.currency}`
        : "Change rules not stated by the airline";

  const cancelText =
    refund.allowed === false
      ? "Non-refundable — you lose the fare if you cancel"
      : refund.allowed === true
        ? refund.fee === 0 || refund.fee === null
          ? "Fully refundable"
          : `Refundable less ${refund.fee} ${fare.price.currency}`
        : "Refund rules not stated by the airline";

  const tone: Tone = refund.allowed === true ? "good" : refund.allowed === false ? "warn" : "info";

  return {
    changeAllowed: change.allowed,
    changeFee: change.fee,
    refundAllowed: refund.allowed,
    refundFee: refund.fee,
    atRisk,
    changeText,
    cancelText,
    tone,
  };
}

/** One-line summary used on the collapsed card. */
export function riskPill(p: RiskProfile): { text: string; tone: Tone } {
  const text =
    p.band === "low" ? "Low disruption risk" : p.band === "moderate" ? "Minor watch point" : p.band === "elevated" ? "Elevated risk" : "High risk";
  return { text, tone: p.band === "low" ? "good" : p.band === "moderate" ? "info" : p.band === "elevated" ? "warn" : "bad" };
}
