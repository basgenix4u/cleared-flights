"use client";

import Link from "next/link";
import { useState } from "react";
import { FAQS } from "@/lib/faq";
import { INSPIRATION, estimateFlight } from "@/lib/destinations";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconArrow, IconChevron } from "@/components/ui/icons";
import { Sign } from "@/components/ui/marks";

const wrap = "mx-auto max-w-[1320px] px-4 md:px-8";

export function Inspiration() {
  const [tab, setTab] = useState(INSPIRATION[0].id);
  const current = INSPIRATION.find((t) => t.id === tab) ?? INSPIRATION[0];
  return (
    <section className="border-t border-line bg-paper-2/60 py-24" aria-labelledby="insp-h">
      <div className={wrap}>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Travel inspiration</p>
            <h2 id="insp-h" className="serif mt-3 text-[clamp(1.9rem,3vw,2.7rem)] leading-[1.08] tracking-[-0.02em]">Start from the kind of trip.</h2>
          </div>
          <div role="tablist" aria-label="Trip type" className="flex flex-wrap gap-2">
            {INSPIRATION.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const i = INSPIRATION.findIndex((x) => x.id === tab);
                  if (e.key === "ArrowRight") setTab(INSPIRATION[(i + 1) % INSPIRATION.length].id);
                  if (e.key === "ArrowLeft") setTab(INSPIRATION[(i + INSPIRATION.length - 1) % INSPIRATION.length].id);
                }}
                className={cn("h-11 rounded-sm border px-4 text-[13.5px] font-semibold transition-colors md:h-10", tab === t.id ? "border-ink bg-ink text-paper" : "border-line-2 hover:border-ink")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} key={current.id} className="rise mt-10 grid border-t-[1.5px] border-ink lg:grid-cols-3">
          {current.items.map((it, i) => {
            const f = estimateFlight(it.from, it.to);
            return (
              <Link
                key={it.to}
                href={`/?from=${it.from}&to=${it.to}#search`}
                className={cn("group flex min-h-[260px] flex-col justify-between border-b border-line p-6 transition-colors hover:bg-card lg:border-b-0", i > 0 && "lg:border-l")}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Sign code={it.from} size="sm" /> <IconArrow width={14} height={14} className="text-ink-3" /> <Sign code={it.to} size="sm" />
                  </div>
                  <h3 className="serif mt-6 text-[34px] leading-[1.02] tracking-[-0.02em]">
                    {it.toCity} <em className="text-ink-3">from {it.fromCity}</em>
                  </h3>
                  <p className="mt-3 max-w-[38ch] text-[14.5px] leading-relaxed text-ink-2">{it.line}</p>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <span className="font-mono text-[11.5px] text-ink-3">≈ {fmtDuration(f.min)} · estimate</span>
                  <span className="nudge inline-flex items-center gap-2 text-[13.5px] font-semibold">Choose dates <IconArrow className="arrow" width={15} height={15} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FaqList({ limit, className }: { limit?: number; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const items = limit ? FAQS.slice(0, limit) : FAQS;
  return (
    <ul className={cn("border-t-[1.5px] border-ink", className)}>
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.q} className="border-b border-line">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                id={`faq-btn-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-start justify-between gap-6 py-5 text-left"
              >
                <span>
                  <span className="eyebrow block">{f.topic}</span>
                  <span className="mt-1 block text-[17px] font-semibold leading-snug tracking-[-0.015em]">{f.q}</span>
                </span>
                <IconChevron className={cn("mt-6 shrink-0 transition-transform duration-300", isOpen && "rotate-180")} />
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className="fold" data-open={isOpen}>
              <div>
                <p className="max-w-[68ch] pb-6 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FaqSection() {
  return (
    <section className={`${wrap} py-24`} aria-labelledby="faq-h">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-h" className="mt-3 text-[clamp(1.6rem,2.4vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.03em]">Straight answers about searching, paying and changing plans.</h2>
          <p className="mt-4 text-[14.5px] text-ink-3">More detail lives in the <Link href="/help" className="font-semibold text-ink underline underline-offset-4">help centre</Link>.</p>
        </div>
        <FaqList className="lg:col-span-8" />
      </div>
    </section>
  );
}
