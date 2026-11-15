import type { Mode } from "../config";
import type {
  BookingStatus,
  ExtraOption,
  Fare,
  FareExtras,
  Itinerary,
  PassengerInput,
  SearchQuery,
} from "../types";

export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
    public httpStatus = 502,
  ) {
    super(message);
  }
}

export interface FareLookup {
  itinerary: Itinerary;
  fare: Fare;
  extras: FareExtras;
}
export type GetFareResult = { status: "ok"; data: FareLookup } | { status: "expired" | "unavailable" };

export interface CreateOrderArgs {
  fare: Fare;
  itinerary: Itinerary;
  passengers: PassengerInput[];
  contact: { email: string; phone: string };
  extras: { option: ExtraOption; passenger: number; qty: number }[];
  /** provider-currency amount to pay: fare + paid services (excludes our service fee) */
  providerAmount: string;
  reference: string;
  idempotencyKey: string;
}

export interface OrderResult {
  providerOrderId: string;
  pnr: string | null;
  ticketNumbers: string[];
  status: BookingStatus;
  paymentStatus: "simulated" | "paid";
}

export interface CancelQuote {
  allowed: boolean;
  refundAmount: number;
  currency: string;
  providerQuoteId?: string;
  note: string;
}

export interface FlightProvider {
  mode: Mode;
  supportsCalendar: boolean;
  search(q: SearchQuery): Promise<Itinerary[]>;
  getFare(offerId: string, stored: Itinerary[]): Promise<GetFareResult>;
  createOrder(args: CreateOrderArgs): Promise<OrderResult>;
  quoteCancellation(args: { providerOrderId: string | null; fare: Fare; paidAirline: number }): Promise<CancelQuote>;
  confirmCancellation(args: { providerOrderId: string | null; quote: CancelQuote }): Promise<{ refundAmount: number }>;
  lowestFares(q: SearchQuery, dates: string[]): Promise<Record<string, number | null>>;
}
