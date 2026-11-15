import { FEE } from "./config";
import type { ExtraOption, ExtraSelection, PriceBreakdown, SearchQuery } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

type Paying = Pick<SearchQuery, "adults" | "children">;

/**
 * Our fee: a percentage of the airline amount, floored and capped per paying
 * traveller (infants on laps pay nothing).
 *
 * Why not a flat fee: the supplier charges a fixed amount *plus a percentage of
 * order value*, so a flat fee is below cost on any expensive ticket — and the loss
 * grows with the ticket. The floor protects cheap domestic fares (where fixed
 * provider costs dominate); the cap keeps expensive tickets defensible, because a
 * customer can see the fee and compare it with the fare.
 *
 * See docs/04-business-analysis.md §4 for the arithmetic.
 */
export function serviceFee(q: Paying, airlineAmount = 0): number {
  const paying = Math.max(1, q.adults + q.children);
  if (FEE.percent <= 0) return round2(paying * FEE.flat);
  const raw = (airlineAmount * FEE.percent) / 100;
  const perTraveller = Math.min(Math.max(raw, FEE.min), FEE.max);
  return round2(perTraveller);
}

/** The fee expressed the way the customer sees it on a result card. */
export function feeSummary(): { percent: number; min: number; max: number; flat: number } {
  return { ...FEE };
}

export function buildPrice(
  q: Pick<SearchQuery, "adults" | "children" | "infants">,
  currency: string,
  fare: number,
  taxes: number,
): PriceBreakdown {
  const fee = serviceFee(q, round2(fare + taxes));
  const total = round2(fare + taxes + fee);
  return {
    currency,
    fare: round2(fare),
    taxes: round2(taxes),
    serviceFee: fee,
    total,
    perTraveller: round2(total / Math.max(1, q.adults + q.children + q.infants)),
  };
}

export function priceExtras(options: ExtraOption[], selections: ExtraSelection[]) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const lines: { option: ExtraOption; passenger: number; qty: number; amount: number }[] = [];
  for (const s of selections) {
    const option = byId.get(s.optionId);
    if (!option) throw new Error(`Unknown extra: ${s.optionId}`);
    if (option.passengerIndex !== undefined && option.passengerIndex !== s.passenger) throw new Error("Extra not valid for passenger");
    if (s.qty > option.max) throw new Error("Quantity exceeds maximum");
    lines.push({ option, passenger: s.passenger, qty: s.qty, amount: round2(option.price * s.qty) });
  }
  return { lines, total: round2(lines.reduce((a, l) => a + l.amount, 0)) };
}

/**
 * What the ticket will cost the customer by the time they reach the gate, given
 * what they actually travel with. This is the number the fee is justified against,
 * and the number competitors hide until the payment page.
 */
export function trueCost(
  price: PriceBreakdown,
  opts: { checkedBags: number; bagPrice: number; seatPrice?: number; needsSeat?: boolean },
): { total: number; bagLines: number; seatLine: number } {
  const bagLines = round2(opts.checkedBags * opts.bagPrice);
  const seatLine = opts.needsSeat ? round2(opts.seatPrice ?? 0) : 0;
  return { total: round2(price.total + bagLines + seatLine), bagLines, seatLine };
}
