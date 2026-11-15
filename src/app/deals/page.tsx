import type { Metadata } from "next";
import { FareCalendar } from "@/components/deals/FareCalendar";

export const metadata: Metadata = {
  title: "Deals · Lowest fares by date",
  description: "See the lowest all-in flight total for every departure day in a month, for any route.",
};

export default function DealsPage() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-12 md:px-8">
      <p className="eyebrow">Deals · Fare calendar</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(1.9rem,3.4vw,2.9rem)] font-bold leading-[1.06] tracking-[-0.035em]">The cheapest day to fly is rarely the one you picked.</h1>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">We don’t invent discounts. This shows the lowest all-in total for each departure day on a route, so you can move your dates to where the real saving is.</p>
      <div className="mt-10"><FareCalendar /></div>
    </div>
  );
}
