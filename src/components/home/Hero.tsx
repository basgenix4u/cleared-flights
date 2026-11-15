import Image from "next/image";
import { Suspense } from "react";
import { SearchForm } from "@/components/search/SearchForm";
import { Skeleton } from "@/components/ui/ui";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1320px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <p className="eyebrow">Flight search · all-in pricing</p>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(1.9rem,3.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            Search flights. See the full price first.
          </h1>
          <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-2">
            Taxes, carrier surcharges and our fee are in every fare. Baggage and change rules sit on the result card, so you can compare before you open anything.
          </p>
          <div className="mt-8">
            <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
              <SearchForm />
            </Suspense>
          </div>
        </div>

        <figure className="relative hidden lg:col-span-5 lg:flex lg:flex-col">
          <div className="relative min-h-[560px] flex-1">
            {(["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"] as const).map((c) => (
              <span key={c} aria-hidden className={`absolute z-10 h-3 w-3 border-ink ${c}`} style={{ margin: -6 }} />
            ))}
            <Image
              src="/images/hero-wing.jpg"
              alt="The wing of an airliner above a layer of cloud at first light"
              fill
              priority
              sizes="(min-width:1024px) 40vw, 0px"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-3 flex items-start justify-between gap-4 font-mono text-[11px] leading-snug text-ink-3">
            <span>FIG. 01 — First light, cruise altitude. Left wing, window seat.</span>
            <span className="shrink-0 text-ink">Illustration</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
