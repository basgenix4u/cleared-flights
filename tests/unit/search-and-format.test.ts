import { describe, expect, it } from "vitest";
import { queryInputSchema, parseQuery, queryToSearchString, travellerCount } from "@/lib/search-params";
import {
  CABIN_LABEL,
  addDays,
  countryName,
  dateOf,
  dayDelta,
  fmtDateTimeUtc,
  fmtDay,
  fmtDuration,
  fmtMoney,
  fmtMoneyWhole,
  plural,
  stopsLabel,
  timeOf,
  todayISO,
} from "@/lib/format";

const future = (days = 30) => addDays(todayISO(), days);

const validOneWay = {
  trip: "oneway" as const,
  legs: [{ from: "LOS", to: "LHR", date: future() }],
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "economy" as const,
};

describe("queryInputSchema", () => {
  it("accepts a valid one-way search", () => {
    expect(queryInputSchema.safeParse(validOneWay).success).toBe(true);
  });

  it("rejects an unknown airport code instead of searching for it", () => {
    const bad = { ...validOneWay, legs: [{ from: "ZZZ", to: "LHR", date: future() }] };
    const res = queryInputSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });

  it("rejects a same-city pair (LHR → LGW) because it is not a journey", () => {
    const bad = { ...validOneWay, legs: [{ from: "LHR", to: "LGW", date: future() }] };
    expect(queryInputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects dates in the past and beyond the airline horizon", () => {
    expect(
      queryInputSchema.safeParse({ ...validOneWay, legs: [{ from: "LOS", to: "LHR", date: "2020-01-01" }] }).success,
    ).toBe(false);
    expect(
      queryInputSchema.safeParse({ ...validOneWay, legs: [{ from: "LOS", to: "LHR", date: addDays(todayISO(), 400) }] })
        .success,
    ).toBe(false);
  });

  it("requires a return leg for a round trip and exactly one for a one-way", () => {
    expect(queryInputSchema.safeParse({ ...validOneWay, trip: "round" }).success).toBe(false);
    expect(
      queryInputSchema.safeParse({
        ...validOneWay,
        legs: [validOneWay.legs[0], { ...validOneWay.legs[0], date: future(40) }],
      }).success,
    ).toBe(false);
  });

  it("enforces the party-size cap and one adult per infant", () => {
    expect(queryInputSchema.safeParse({ ...validOneWay, adults: 8, children: 5 }).success).toBe(false);
    expect(queryInputSchema.safeParse({ ...validOneWay, adults: 1, infants: 2 }).success).toBe(false);
    expect(queryInputSchema.safeParse({ ...validOneWay, adults: 2, infants: 2 }).success).toBe(true);
  });

  it("caps adults at nine and children at eight independently", () => {
    expect(queryInputSchema.safeParse({ ...validOneWay, adults: 10 }).success).toBe(false);
    expect(queryInputSchema.safeParse({ ...validOneWay, children: 9 }).success).toBe(false);
  });
});

describe("parseQuery / queryToSearchString", () => {
  it("round-trips a one-way search", () => {
    const qs = queryToSearchString({ ...validOneWay });
    const parsed = parseQuery(new URLSearchParams(qs));
    expect(parsed).not.toBeNull();
    expect(parsed?.trip).toBe("oneway");
    expect(parsed?.legs[0]).toMatchObject({ from: "LOS", to: "LHR", date: future() });
    expect(parsed?.cabin).toBe("economy");
  });

  it("round-trips a multi-city search", () => {
    const multi = {
      trip: "multi" as const,
      legs: [
        { from: "LOS", to: "LHR", date: future(10) },
        { from: "LHR", to: "JFK", date: future(15) },
        { from: "JFK", to: "LOS", date: future(25) },
      ],
      adults: 2,
      children: 1,
      infants: 0,
      cabin: "business" as const,
    };
    const parsed = parseQuery(new URLSearchParams(queryToSearchString(multi)));
    expect(parsed?.legs).toHaveLength(3);
    expect(parsed?.legs[2].from).toBe("JFK");
    expect(parsed?.adults).toBe(2);
  });

  it("returns null rather than guessing when the structure is unusable", () => {
    expect(parseQuery(new URLSearchParams(""))).toBeNull();
    expect(parseQuery(new URLSearchParams("trip=oneway"))).toBeNull();
  });

  it("never emits an empty date or airport into a URL", () => {
    const qs = queryToSearchString({ ...validOneWay });
    for (const [, v] of new URLSearchParams(qs)) expect(v).not.toBe("");
  });
});

describe("travellerCount", () => {
  it("counts every seat including lap infants", () => {
    expect(travellerCount({ adults: 2, children: 1, infants: 1 })).toBe(4);
    expect(travellerCount({ adults: 1, children: 0, infants: 0 })).toBe(1);
  });
});

describe("format helpers", () => {
  it("formats money with the right symbol and precision", () => {
    expect(fmtMoney(424.3, "USD")).toContain("424.30");
    expect(fmtMoneyWhole(424.3, "USD")).not.toContain(".30");
    expect(fmtMoney(1500, "NGN")).toMatch(/1,500/);
  });

  it("formats a duration as hours and minutes", () => {
    expect(fmtDuration(362)).toBe("6h 02m");
    expect(fmtDuration(60)).toBe("1h 00m");
  });

  it("drops the hour part under an hour rather than printing 0h", () => {
    expect(fmtDuration(45)).toBe("45m");
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(59)).toBe("59m");
  });

  it("pluralises without a stray s", () => {
    expect(plural(1, "traveller")).toBe("1 traveller");
    expect(plural(2, "traveller")).toBe("2 travellers");
    expect(plural(0, "traveller")).toBe("0 travellers");
  });

  it("labels stops the way a traveller reads them", () => {
    expect(stopsLabel(0)).toBe("Nonstop");
    expect(stopsLabel(1)).toBe("1 stop");
    expect(stopsLabel(2)).toBe("2 stops");
  });

  it("formats a date without letting the timezone shift the day", () => {
    // a bare date parsed as UTC midnight must still read as the 20th everywhere
    expect(fmtDay("2026-12-20")).toContain("20");
    expect(fmtDay("2026-12-20", "long")).toContain("December");
    expect(fmtDay("2026-12-20", "month")).toContain("December");
  });

  it("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("time and date helpers", () => {
  it("reads the clock and the date out of a local ISO string", () => {
    expect(timeOf("2026-12-20T16:05:00")).toBe("16:05");
    expect(dateOf("2026-12-20T16:05:00")).toBe("2026-12-20");
  });

  it("counts the calendar days between two local times", () => {
    expect(dayDelta("2026-12-20T23:50:00", "2026-12-21T00:30:00")).toBe(1);
    expect(dayDelta("2026-12-20T08:00:00", "2026-12-20T22:00:00")).toBe(0);
    expect(dayDelta("2026-12-20T01:00:00", "2026-12-19T23:00:00")).toBe(-1);
  });

  it("renders a UTC timestamp with the zone spelled out, so it cannot be misread", () => {
    const out = fmtDateTimeUtc("2026-12-20T16:05:00.000Z");
    expect(out).toBe("20 Dec, 16:05 UTC");
    expect(out.endsWith("UTC")).toBe(true);
  });

  it("labels every cabin we sell", () => {
    for (const cabin of ["economy", "premium_economy", "business", "first"]) {
      expect(CABIN_LABEL[cabin]).toBeTruthy();
    }
  });

  it("names a country from its code, and never prints a raw blank for an unknown one", () => {
    expect(countryName("NG")).toMatch(/Nigeria/i);
    expect(countryName("ZZ")).toBeTruthy();
    expect(countryName("ZZ")).not.toBe("");
  });
});
