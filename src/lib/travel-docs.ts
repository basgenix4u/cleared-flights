import type { PassengerInput } from "./types";

/**
 * Travel-document readiness.
 *
 * These are the failures that happen *at the airport* and that no booking flow
 * currently prevents: a passport that expires within six months, a name that does
 * not match the machine-readable zone, an infant booked as a child.
 *
 * Everything returns advice, never a guarantee: entry rules are the border
 * authority's, and the UI must say so.
 */

export type ChecklistStatus = "pass" | "warn" | "fail" | "unknown";

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  status: ChecklistStatus;
}

const HONORIFICS = /\b(mr|mrs|ms|miss|dr|prof|chief|alhaji|hajia|engr|pastor)\b\.?/i;
const NAME_OK = /^[A-Za-z][A-Za-z\s'’.-]*$/;

export interface NameIssue {
  field: "givenName" | "familyName";
  message: string;
}

/**
 * Names must match the passport exactly, because the airline transmits them to the
 * border authority verbatim. These checks catch the recurring causes of denied
 * boarding: titles left in the name field, names swapped, duplicated surnames.
 */
export function nameIssues(p: Pick<PassengerInput, "givenName" | "familyName">): NameIssue[] {
  const issues: NameIssue[] = [];
  const given = p.givenName?.trim() ?? "";
  const family = p.familyName?.trim() ?? "";

  if (HONORIFICS.test(given) || HONORIFICS.test(family))
    issues.push({ field: "givenName", message: "Remove titles such as Mr, Mrs, Dr or Alhaji — they are not part of your name on the passport." });
  if (given && !NAME_OK.test(given))
    issues.push({ field: "givenName", message: "Use Latin letters as printed in the passport's machine-readable zone; remove numbers and symbols." });
  if (family && !NAME_OK.test(family))
    issues.push({ field: "familyName", message: "Use Latin letters as printed in the passport's machine-readable zone; remove numbers and symbols." });
  if (family.length === 1) issues.push({ field: "familyName", message: "A single letter surname is usually a typo — check the passport spelling." });
  if (given && family && given.toLowerCase() === family.toLowerCase())
    issues.push({ field: "givenName", message: "Given name and surname are identical — airlines reject these." });
  if (given && given.toLowerCase().split(/\s+/).includes(family.toLowerCase()) && family)
    issues.push({ field: "givenName", message: "Surname is repeated in the given-name field." });
  if (given.length > 30 || family.length > 30)
    issues.push({ field: "givenName", message: "Names over 30 characters often fail airline systems; check the booking against your passport after ticketing." });

  return issues;
}

const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const monthsBetween = (fromIso: string, toIso: string) => {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
};

export function ageOn(bornOn: string, travelIso: string): number {
  return Math.max(0, monthsBetween(bornOn, travelIso) / 12);
}

/**
 * The six-month rule: many countries refuse entry unless the passport is valid for
 * at least six months beyond the date of entry. Some use three. We advise six and
 * say why, rather than claiming to know the destination's rule.
 */
export function passportValidity(expiry: string | undefined, lastTravelIso: string): ChecklistItem {
  if (!expiry)
    return {
      id: "passport-validity",
      label: "Passport validity",
      detail: "Add each traveller's passport expiry so we can check the six-month rule.",
      status: "unknown",
    };
  const required = addMonths(lastTravelIso, 6);
  if (expiry >= required)
    return { id: "passport-validity", label: "Passport valid beyond the six-month rule", detail: `Valid to ${expiry}. Six months past ${lastTravelIso} needs validity until at least ${required}.`, status: "pass" };
  const requiredThree = addMonths(lastTravelIso, 3);
  if (expiry >= requiredThree)
    return {
      id: "passport-validity",
      label: "Passport may fail the six-month rule",
      detail: `Expires ${expiry}. It clears three months past your return date but not six. Some destinations accept three months; many do not. Renew before booking.`,
      status: "warn",
    };
  return {
    id: "passport-validity",
    label: "Passport expires too soon to travel",
    detail: `Expires ${expiry}, before ${requiredThree}. Airlines will not board you. Renew first — the ticket cannot be used.`,
    status: "fail",
  };
}

export function infantAndChildAges(passengers: PassengerInput[], travelIso: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  passengers.forEach((p, i) => {
    if (!p.bornOn) return;
    const age = ageOn(p.bornOn, travelIso);
    const who = `${p.givenName || `Traveller ${i + 1}`}`;
    if (p.type === "infant" && age >= 2)
      items.push({ id: `age-${i}`, label: `${who}: infant fare past the second birthday`, detail: "Infant fares end at 2. Airlines will charge a child fare at the airport.", status: "warn" });
    if (p.type === "child" && (age < 2 || age >= 12))
      items.push({
        id: `age-${i}`,
        label: `${who}: child fare outside 2–11`,
        detail: age < 2 ? "Under 2 — an infant or lap fare applies and the ticket will be repriced." : "12 or older — an adult fare applies.",
        status: "warn",
      });
    if (p.type === "adult" && age < 12) items.push({ id: `age-${i}`, label: `${who}: adult ticket for a child`, detail: "Legal but you are paying more than you need to.", status: "warn" });
  });
  return items;
}

export interface ReadinessInput {
  passengers: PassengerInput[];
  departIso: string;
  lastTravelIso: string;
  international: boolean;
  checkedBagsIncluded: number;
  nights: number;
}

/** The pre-departure checklist shown on a booking, from data we already hold. */
export function departureReadiness(input: ReadinessInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const p of input.passengers) items.push(passportValidity(p.passportExpiry, input.lastTravelIso));
  items.push(...infantAndChildAges(input.passengers, input.departIso));

  const nameProblems = input.passengers.flatMap((p) => nameIssues(p));
  if (nameProblems.length) {
    items.push({
      id: "name-match",
      label: "Name does not look like a passport name",
      detail: nameProblems[0].message,
      status: "warn",
    });
  } else if (input.passengers.every((p) => p.givenName && p.familyName)) {
    items.push({ id: "name-match", label: "Names pass the passport format check", detail: "No titles, symbols or duplicates. Still check every letter against the passport — airlines charge for corrections.", status: "pass" });
  }

  if (input.international) {
    items.push({
      id: "visa",
      label: "Visa and transit requirements",
      detail: "Entry and transit rules depend on your passport and the route. Check the destination's embassy for every country you touch, including where you change planes.",
      status: "unknown",
    });
  }

  const nights = input.nights;
  const bagPieces = input.checkedBagsIncluded;
  if (nights >= 4 && bagPieces === 0)
    items.push({ id: "bags", label: "No checked bag included", detail: `${nights} nights with cabin baggage only. Adding a bag later is usually more expensive than at booking.`, status: "warn" });
  else if (bagPieces > 0)
    items.push({ id: "bags", label: `${bagPieces} checked bag${bagPieces > 1 ? "s" : ""} included`, detail: "Confirm the weight limit — it is per piece, not per traveller, on most carriers.", status: "pass" });

  items.push({
    id: "checkin",
    label: "Online check-in",
    detail: `Opens about 24–72 hours before departure. Check-in for an international flight usually closes 60 minutes before, earlier at some airports.`,
    status: "unknown",
  });

  return items;
}

/** Human summary used by badges: how many things need action before the airport. */
export function readinessScore(items: ChecklistItem[]): { fails: number; warns: number; unknowns: number; label: string; status: ChecklistStatus } {
  const fails = items.filter((i) => i.status === "fail").length;
  const warns = items.filter((i) => i.status === "warn").length;
  const unknowns = items.filter((i) => i.status === "unknown").length;
  const status: ChecklistStatus = fails ? "fail" : warns ? "warn" : unknowns ? "unknown" : "pass";
  const label = fails ? "Not ready to travel" : warns ? "Action needed" : unknowns ? "Not verified yet" : "Ready to travel";
  return { fails, warns, unknowns, label, status };
}
