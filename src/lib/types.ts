import type { Mode } from "./config";

export type Cabin = "economy" | "premium_economy" | "business" | "first";
export type TripType = "round" | "oneway" | "multi";

export interface Leg {
  from: string; // IATA airport or metro code
  to: string;
  date: string; // YYYY-MM-DD
}

export interface SearchQuery {
  trip: TripType;
  legs: Leg[];
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
}

export interface AirportRef {
  code: string;
  name: string;
  city: string;
  cc: string;
  tz: string;
}

export interface Carrier {
  code: string;
  name: string;
  color?: string;
  logoUrl?: string;
}

export interface Segment {
  id: string;
  carrier: Carrier;
  operatingCarrier: Carrier;
  flightNumber: string;
  aircraft?: string;
  origin: AirportRef;
  destination: AirportRef;
  departLocal: string; // YYYY-MM-DDTHH:mm wall-clock at origin
  arriveLocal: string;
  durationMin: number;
}

export type LayoverFlag = "short" | "long" | "overnight" | "airport_change";

export interface Layover {
  airport: AirportRef;
  durationMin: number;
  flags: LayoverFlag[];
}

export interface Slice {
  id: string;
  origin: AirportRef;
  destination: AirportRef;
  departLocal: string;
  arriveLocal: string;
  durationMin: number;
  segments: Segment[];
  layovers: Layover[];
}

export interface Baggage {
  cabin: number | null; // pieces; null = not stated
  checked: number | null;
  checkedKg?: number | null;
}

export interface Conditions {
  refund: { allowed: boolean | null; fee: number | null };
  change: { allowed: boolean | null; fee: number | null };
  seat: "free" | "paid" | "at_checkin" | "unknown";
}

export interface PriceBreakdown {
  currency: string;
  fare: number; // airline base fare, all travellers
  taxes: number; // taxes + carrier-imposed surcharges
  serviceFee: number;
  total: number;
  perTraveller: number;
}

export interface Fare {
  offerId: string;
  brand: string;
  cabin: Cabin;
  baggage: Baggage;
  conditions: Conditions;
  perks: string[];
  price: PriceBreakdown;
  expiresAt: string; // ISO
  providerTotal: string; // exact provider amount (string) – used for payment
  providerCurrency: string;
  passengerIds: { id: string; type: "adult" | "child" | "infant" }[];
  /** demo only: true once a simulated re-price has been applied */
  repriced?: boolean;
}

export interface Itinerary {
  id: string;
  owner: Carrier;
  slices: Slice[];
  fares: Fare[]; // ascending by total
  stops: number; // max stops across slices
  durationMin: number; // sum of slice durations
}

export interface ExtraOption {
  id: string;
  kind: "baggage" | "seat" | "meal" | "assist";
  label: string;
  description?: string;
  price: number;
  sliceIndex?: number;
  passengerIndex?: number;
  providerServiceId?: string;
  max: number;
}

export interface FareExtras {
  currency: string;
  options: ExtraOption[];
}

export interface ExtraSelection {
  optionId: string;
  passenger: number;
  qty: number;
}

export interface SearchResultPayload {
  sessionId: string;
  mode: Mode;
  searchedAt: string;
  expiresAt: string;
  itineraries: Itinerary[];
}

export type BookingStatus = "simulated" | "requested" | "confirmed" | "ticketed" | "cancelled" | "failed";

export interface PassengerInput {
  type: "adult" | "child" | "infant";
  title: "mr" | "ms" | "mrs" | "miss";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportCountry?: string;
}

export interface BookingEvent {
  at: string;
  label: string;
  detail?: string;
}
