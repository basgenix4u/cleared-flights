import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/ExploreClient";

export const metadata: Metadata = {
  title: "Explore destinations",
  description: "Destination notes with best months and estimated flight times. Pick an origin, then search the route.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-12 md:px-8">
      <p className="eyebrow">Explore</p>
      <h1 className="serif mt-3 max-w-3xl text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.04] tracking-[-0.025em]">Destination notes, with the practical bits first.</h1>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">When to go, roughly how long the flight is from where you are, and a direct route into the search. No prices appear here because a price only means something for dates you choose.</p>
      <div className="mt-10"><ExploreClient /></div>
    </div>
  );
}
