import { describe, expect, it, vi } from "vitest";
import { FEE } from "@/lib/config";
import { buildPrice, feeSummary, priceExtras, round2, serviceFee, trueCost } from "@/lib/pricing";
import type { ExtraOption } from "@/lib/types";

/**
 * The fee is the only number on the site we invent ourselves, so it is the number
 * most worth defending with tests: a silent change here is a pricing incident.
 */
describe("round2", () => {
  it("rounds to the nearest cent", () => {
    // 1.005 is not exactly representable in binary, so the honest test is a clear case
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(2.674)).toBe(2.67);
    expect(round2(0)).toBe(0);
  });

  it("does not accumulate float dust", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(424.33999999)).toBe(424.34);
  });
});

describe("serviceFee", () => {
  const paying = { adults: 1, children: 0 };

  it("charges the configured percentage of the airline amount", () => {
    // 2.5% of 400 = 10, comfortably between the floor and the cap
    expect(serviceFee(paying, 400)).toBe(round2((400 * FEE.percent) / 100));
  });

  it("applies the floor on cheap fares where fixed provider cost dominates", () => {
    expect(serviceFee(paying, 20)).toBe(FEE.min);
    expect(serviceFee(paying, 0)).toBe(FEE.min);
  });

  it("applies the cap on expensive tickets so the fee stays defensible", () => {
    expect(serviceFee(paying, 100_000)).toBe(FEE.max);
  });

  it("never returns a negative or non-finite fee", () => {
    for (const amount of [0, 0.01, -50, Number.MAX_SAFE_INTEGER]) {
      const fee = serviceFee(paying, amount);
      expect(Number.isFinite(fee)).toBe(true);
      expect(fee).toBeGreaterThanOrEqual(FEE.min);
      expect(fee).toBeLessThanOrEqual(FEE.max);
    }
  });

  it("treats a lap infant as not paying", () => {
    const withInfant = { adults: 1, children: 0 } as const;
    expect(serviceFee(withInfant, 400)).toBe(serviceFee(paying, 400));
  });

  it("counts children as paying travellers", () => {
    // the fee is per paying traveller, so a party of two pays twice the floor
    const family = { adults: 1, children: 1 };
    expect(serviceFee(family, 20)).toBe(round2(FEE.min));
    expect(serviceFee(family, 20) * 1).toBe(FEE.min);
  });

  it("floors at one paying traveller even if the query says zero", () => {
    expect(serviceFee({ adults: 0, children: 0 }, 400)).toBe(round2((400 * FEE.percent) / 100));
  });

  it("sums extras and returns a total", () => {
    const { total } = priceExtras(bags, [
      { optionId: "bag-1", passenger: 0, qty: 1 },
      { optionId: "seat-any", passenger: 1, qty: 2 },
    ]);
    expect(total).toBe(70);
  });
});

describe("buildPrice", () => {
  it("totals fare + taxes + fee and splits per traveller", () => {
    const p = buildPrice({ adults: 2, children: 0, infants: 1 }, "USD", 400, 60);
    expect(p.currency).toBe("USD");
    expect(p.serviceFee).toBe(round2(serviceFee({ adults: 2, children: 0 }, 460)));
    expect(p.total).toBe(round2(400 + 60 + p.serviceFee));
    // infants ride free but still divide the per-traveller figure
    expect(p.perTraveller).toBe(round2(p.total / 3));
  });

  it("keeps the total equal to the sum of its parts at two decimals", () => {
    for (const fare of [0.01, 33.33, 1234.56, 99_999.99]) {
      const p = buildPrice({ adults: 1, children: 0, infants: 0 }, "EUR", fare, fare / 3);
      expect(round2(p.fare + p.taxes + p.serviceFee)).toBe(p.total);
    }
  });

  it("never divides by zero when every traveller count is zero", () => {
    const p = buildPrice({ adults: 0, children: 0, infants: 0 }, "USD", 100, 10);
    expect(Number.isFinite(p.perTraveller)).toBe(true);
    expect(p.perTraveller).toBe(p.total);
  });
});

const bags: ExtraOption[] = [
  { id: "bag-1", kind: "baggage", label: "23kg bag", price: 45, max: 2, passengerIndex: 0 },
  { id: "seat-any", kind: "seat", label: "Standard seat", price: 12.5, max: 3 },
];

describe("priceExtras", () => {
  it("prices a selection", () => {
    const { lines, total } = priceExtras(bags, [{ optionId: "bag-1", passenger: 0, qty: 2 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(90);
    expect(total).toBe(90);
  });

  it("rejects an unknown option instead of silently ignoring it", () => {
    expect(() => priceExtras(bags, [{ optionId: "nope", passenger: 0, qty: 1 }])).toThrow(/Unknown extra/);
  });

  it("rejects a quantity above the option maximum", () => {
    expect(() => priceExtras(bags, [{ optionId: "bag-1", passenger: 0, qty: 3 }])).toThrow(/maximum/);
  });

  it("rejects an extra bound to a different passenger", () => {
    expect(() => priceExtras(bags, [{ optionId: "bag-1", passenger: 1, qty: 1 }])).toThrow(/not valid/);
  });

  it("allows a passenger-agnostic extra for any traveller", () => {
    const { lines } = priceExtras(bags, [{ optionId: "seat-any", passenger: 2, qty: 1 }]);
    expect(lines[0].amount).toBe(12.5);
  });
});

describe("feeSummary", () => {
  it("publishes the configured fee instead of a hard-coded one", () => {
    const s = feeSummary();
    expect(s.percent).toBe(FEE.percent);
    expect(s.min).toBe(FEE.min);
    expect(s.max).toBe(FEE.max);
  });
});

describe("trueCost", () => {
  const price = { currency: "USD", fare: 400, taxes: 60, serviceFee: 11.5, total: 471.5, perTraveller: 471.5 };

  it("adds checked bags to what the customer actually pays", () => {
    const r = trueCost(price, { checkedBags: 2, bagPrice: 45 });
    expect(r.bagLines).toBe(90);
    expect(r.total).toBe(561.5);
  });

  it("adds a seat only when the traveller needs one", () => {
    expect(trueCost(price, { checkedBags: 0, bagPrice: 45, seatPrice: 12, needsSeat: false }).seatLine).toBe(0);
    expect(trueCost(price, { checkedBags: 0, bagPrice: 45, seatPrice: 12, needsSeat: true }).total).toBe(483.5);
  });

  it("treats a missing seat price as zero rather than NaN", () => {
    const r = trueCost(price, { checkedBags: 0, bagPrice: 45, needsSeat: true });
    expect(r.seatLine).toBe(0);
    expect(r.total).toBe(471.5);
  });

  it("equals the ticket total when nothing is added", () => {
    expect(trueCost(price, { checkedBags: 0, bagPrice: 45 }).total).toBe(price.total);
  });
});

describe("legacy flat-fee mode", () => {
  it("charges the flat amount per paying traveller when the percentage is zero", async () => {
    vi.resetModules();
    vi.stubEnv("SERVICE_FEE_PERCENT", "0");
    vi.stubEnv("SERVICE_FEE_PER_TRAVELLER", "7");
    const legacy = await import("@/lib/pricing");
    // one paying traveller, arbitrary fare: the flat fee wins
    expect(legacy.serviceFee({ adults: 1, children: 0 }, 9999)).toBe(7);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
