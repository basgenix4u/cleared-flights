"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getPlace } from "@/lib/airports";
import { DESTINATIONS, estimateFlight } from "@/lib/destinations";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconArrow } from "@/components/ui/icons";
import { Sign } from "@/components/ui/marks";

const ORIGINS = ["LON", "NYC", "PAR", "AMS", "SFO", "DXB", "SIN", "SYD"];
const TAGS = ["All", ...Array.from(new Set(DESTINATIONS.flatMap((d) => d.tags)))];

export function ExploreClient() {
  const [tag, setTag] = useState("All");
  const [origin, setOrigin] = useState("LON");
  const list = useMemo(() => DESTINATIONS.filter((d) => tag === "All" || d.tags.includes(tag)), [tag]);
  const from = getPlace(origin);

  return (
    <div>
      <div className="flex flex-col gap-5 border-y border-line py-4 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter by trip type" className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)} className={cn("h-11 rounded-sm border px-3.5 text-[13px] font-semibold transition-colors md:h-9", tag === t ? "border-ink bg-ink text-paper" : "border-line-2 hover:border-ink")}>{t}</button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-[13px] font-semibold">
          Flying from
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="input !h-11 !w-auto min-w-[180px] !py-0 md:!h-9">
            {ORIGINS.map((o) => <option key={o} value={o}>{getPlace(o)?.city} ({o})</option>)}
          </select>
        </label>
      </div>

      <ul className="divide-y divide-line">
        {list.map((d, i) => {
          const f = estimateFlight(origin, d.code);
          const same = origin === d.code || getPlace(origin)?.city === d.city;
          return (
            <li key={d.slug} className="grid gap-6 py-10 md:grid-cols-12" id={d.slug}>
              <div className={cn("md:col-span-5", i % 2 === 1 && "md:order-2 md:col-start-8")}>
                <div className="relative aspect-[4/3] overflow-hidden border border-ink bg-paper-2">
                  <Image src={d.image} alt={`${d.city}, ${d.country}`} fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" />
                  <span className="absolute left-3 top-3"><Sign code={d.code} size="sm" dark /></span>
                </div>
              </div>
              <div className={cn("flex flex-col justify-center md:col-span-6", i % 2 ? "md:order-1 md:col-start-1" : "md:col-start-7")}>
                <p className="eyebrow">{d.country} · {d.tags.join(" · ")}</p>
                <h2 className="serif mt-2 text-[44px] leading-none tracking-[-0.02em]">{d.city}</h2>
                <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-ink-2">{d.note}</p>
                <dl className="mt-5 grid max-w-md grid-cols-2 gap-4 border-t border-line pt-4 text-[13.5px]">
                  <div><dt className="eyebrow">Best months</dt><dd className="mt-1 font-semibold">{d.best}</dd></div>
                  <div><dt className="eyebrow">From {from?.city}</dt><dd className="num mt-1 font-semibold">{same ? "Choose another origin" : `≈ ${fmtDuration(f.min)} · ${f.km.toLocaleString("en-US")} km`}</dd></div>
                </dl>
                <p className="mt-1 font-mono text-[11px] text-ink-3">Flight time is an estimate from distance, not a schedule.</p>
                <div className="mt-6">
                  <Link href={`/?from=${origin}&to=${d.code}#search`} aria-disabled={same} className={cn("nudge inline-flex h-11 items-center gap-2 rounded-sm border border-ink bg-signal px-5 text-[14px] font-semibold transition-colors hover:bg-ink hover:text-signal", same && "pointer-events-none opacity-40")}>
                    Search {from?.city} to {d.city} <IconArrow className="arrow" width={16} height={16} />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
