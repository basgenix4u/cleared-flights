"use client";

import { cn } from "@/components/ui/cn";
import { IconAlert, IconCheck, IconClock, IconInfo, IconRefund, IconShield } from "@/components/ui/icons";
import { flexibility, riskPill, riskProfile, type RiskProfile, type Tone } from "@/lib/itinerary-insight";
import { fmtMoney } from "@/lib/format";
import type { Fare, Itinerary } from "@/lib/types";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-go",
  warn: "text-warn",
  bad: "text-stop",
  info: "text-ink-2",
};
const TONE_BG: Record<Tone, string> = {
  good: "bg-go",
  warn: "bg-[#d6b24a]",
  bad: "bg-stop",
  info: "bg-ink-3",
};
const TONE_BORDER: Record<Tone, string> = {
  good: "border-[#9cc9b0] bg-go-bg",
  warn: "border-[#d6b24a] bg-warn-bg",
  bad: "border-[#e0a49f] bg-stop-bg",
  info: "border-line-2 bg-paper-2/60",
};

function toneIcon(tone: Tone) {
  const Cmp = tone === "good" ? IconCheck : tone === "bad" ? IconAlert : tone === "warn" ? IconAlert : IconInfo;
  return <Cmp width={15} height={15} className="shrink-0" />;
}

/**
 * A score, drawn as a segmented bar rather than a gauge: it reads instantly at small
 * sizes, survives low-quality screens, and never implies more precision than the
 * heuristic actually has.
 */
export function RiskMeter({ profile, compact }: { profile: RiskProfile; compact?: boolean }) {
  const filled = Math.round((profile.score / 100) * 20);
  const tone: Tone = profile.band === "low" ? "good" : profile.band === "moderate" ? "info" : profile.band === "elevated" ? "warn" : "bad";
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <div
        className="flex h-2 flex-1 items-stretch gap-[2px] overflow-hidden"
        role="img"
        aria-label={`Disruption risk ${profile.score} out of 100, ${profile.band}`}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className={cn("flex-1 rounded-[1px]", i < filled ? TONE_BG[tone] : "bg-line")} />
        ))}
      </div>
      <span className={cn("num shrink-0 font-mono text-[11.5px] font-medium tabular-nums", TONE_TEXT[tone])}>
        {profile.score}
        <span className="text-ink-3">/100</span>
      </span>
    </div>
  );
}

/** Compact form for the collapsed result card. */
export function RiskPill({ it, fare }: { it: Itinerary; fare: Fare }) {
  const profile = riskProfile(it, fare);
  const pill = riskPill(profile);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-[2px] text-[11.5px] font-medium", TONE_BORDER[pill.tone], TONE_TEXT[pill.tone])}
      title={profile.factors[0]?.detail ?? profile.headline}
    >
      <IconShield width={13} height={13} />
      {pill.text}
    </span>
  );
}

/** The full panel: what can go wrong, and what changing your mind costs. */
export function TripInsight({ it, fare }: { it: Itinerary; fare: Fare }) {
  const profile = riskProfile(it, fare);
  const flex = flexibility(fare);
  const cur = fare.price.currency;
  const concerns = profile.factors.filter((f) => f.penalty > 0);
  const positives = profile.factors.filter((f) => f.penalty === 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight">Disruption risk</h3>
          <span className="eyebrow">{profile.headline}</span>
        </div>
        <div className="mt-2">
          <RiskMeter profile={profile} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          Scored from connection times, airline changes, arrival hour and fare conditions. It is advice, not a guarantee — airlines
          rebook disrupted passengers at their discretion.
        </p>

        <ul className="mt-4 space-y-2.5">
          {[...concerns, ...positives].map((f) => (
            <li key={f.id} className="flex gap-2.5">
              <span className={cn("mt-[3px]", TONE_TEXT[f.tone])}>{toneIcon(f.tone)}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold leading-snug">{f.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{f.detail}</p>
              </div>
            </li>
          ))}
          {concerns.length === 0 && (
            <li className="flex gap-2.5 text-[13px] text-go">
              <span className="mt-[3px]"><IconCheck width={15} height={15} /></span>
              Nothing in this itinerary stands out as fragile.
            </li>
          )}
        </ul>
      </div>

      <aside className="rounded-sm border border-line-2 bg-card p-4">
        <p className="eyebrow flex items-center gap-1.5">
          <IconRefund width={13} height={13} /> If your plans change
        </p>
        <dl className="mt-3 space-y-3 text-[13px]">
          <div>
            <dt className="font-semibold">Changing the date</dt>
            <dd className="mt-0.5 text-ink-2">{flex.changeText}</dd>
          </div>
          <div>
            <dt className="font-semibold">Cancelling</dt>
            <dd className="mt-0.5 text-ink-2">{flex.cancelText}</dd>
          </div>
          {flex.atRisk !== null && (
            <div className="border-t border-line pt-3">
              <dt className="font-semibold">Money you cannot recover</dt>
              <dd className={cn("num mt-0.5 font-mono text-[15px] font-medium", flex.atRisk > 0 ? "text-stop" : "text-go")}>
                {flex.atRisk > 0 ? fmtMoney(flex.atRisk, cur) : "Nothing"}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-3">
          <IconClock width={13} height={13} className="mt-[1px] shrink-0" />
          Our service fee is not refunded. Airline rules are shown exactly as the airline supplied them.
        </p>
      </aside>
    </div>
  );
}
