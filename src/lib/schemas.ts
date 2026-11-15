import { z } from "zod";
import { addDays } from "./format";
import type { Itinerary, PassengerInput } from "./types";

const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(40, "Too long")
  .regex(/^[\p{L}][\p{L}\s'’.-]*$/u, "Use letters only, exactly as on the passport");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const passengerSchema = z.object({
  type: z.enum(["adult", "child", "infant"]),
  title: z.enum(["mr", "ms", "mrs", "miss"], { error: "Select a title" }),
  givenName: name,
  familyName: name,
  bornOn: isoDate,
  gender: z.enum(["m", "f"], { error: "Select one" }),
  nationality: z.string().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  passportNumber: z.string().trim().regex(/^[A-Za-z0-9]{5,20}$/, "5–20 letters or digits").optional().or(z.literal("")),
  passportExpiry: isoDate.optional().or(z.literal("")),
  passportCountry: z.string().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
});

export const contactSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +14155550123"),
});

export const bookingInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  sessionId: z.string().uuid(),
  offerId: z.string().min(3).max(120),
  acceptedTotal: z.number().positive(),
  contact: contactSchema,
  passengers: z.array(passengerSchema).min(1).max(9),
  extras: z
    .array(z.object({ optionId: z.string().max(120), passenger: z.number().int().min(0).max(8), qty: z.number().int().min(1).max(5) }))
    .max(80),
  consents: z.object({ terms: z.literal(true), names: z.literal(true) }),
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

export interface TravelContext {
  international: boolean;
  firstDeparture: string; // YYYY-MM-DD
  lastDeparture: string;
}

export function ageOn(bornOn: string, date: string): number {
  const [by, bm, bd] = bornOn.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Rules that depend on the itinerary (age on travel date, passport need). Shared by client and server. */
export function passengerContextIssues(p: Partial<PassengerInput>, ctx: TravelContext): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.bornOn && /^\d{4}-\d{2}-\d{2}$/.test(p.bornOn)) {
    const age = ageOn(p.bornOn, ctx.lastDeparture);
    const now = ageOn(p.bornOn, addDays(ctx.firstDeparture, -0));
    if (now < 0) out.bornOn = "Date of birth is after the departure date";
    else if (p.type === "adult" && age < 12) out.bornOn = "Adult passengers must be 12 or older when they travel";
    else if (p.type === "child" && (age < 2 || age > 11)) out.bornOn = "Children must be 2–11 on every flight";
    else if (p.type === "infant" && age >= 2) out.bornOn = "Infants must be under 2 on every flight";
  }
  if (ctx.international) {
    if (!p.nationality) out.nationality = "Required for international travel";
    if (!p.passportCountry) out.passportCountry = "Required for international travel";
    if (!p.passportNumber) out.passportNumber = "Required for international travel";
    if (!p.passportExpiry) out.passportExpiry = "Required for international travel";
    else if (p.passportExpiry <= ctx.lastDeparture) out.passportExpiry = "Passport expires before your trip ends";
  }
  return out;
}

export const supportInputSchema = z.object({
  reference: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(120),
  topic: z.enum(["booking", "baggage", "refund", "change", "payment", "other"]),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});

export const retrieveSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^CLR-[A-Z0-9]{6}$/, "References look like CLR-7K3M9Q"),
  lastName: z.string().trim().min(1, "Enter a surname").max(60),
});

export function travelContextOf(it: Itinerary): TravelContext {
  const deps = it.slices.map((s) => s.departLocal.slice(0, 10)).sort();
  return {
    international: it.slices.some((s) => s.origin.cc !== s.destination.cc || s.segments.some((g) => g.origin.cc !== g.destination.cc)),
    firstDeparture: deps[0],
    lastDeparture: deps[deps.length - 1],
  };
}
