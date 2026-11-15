"use client";

import { addDays, countryName } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconLock } from "@/components/ui/icons";
import { Field } from "@/components/ui/ui";
import { nameIssues, passportValidity } from "@/lib/travel-docs";

export interface PaxForm {
  type: "adult" | "child" | "infant";
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  passportCountry: string;
}

export const emptyPax = (type: PaxForm["type"]): PaxForm => ({ type, title: "", givenName: "", familyName: "", bornOn: "", gender: "", nationality: "", passportNumber: "", passportExpiry: "", passportCountry: "" });

const COUNTRIES = "AR AU AT BD BE BR BG CA CL CN CO HR CY CZ DK EG EE ET FI FR DE GH GR HK HU IS IN ID IE IL IT JP JO KE KR KW LV LB LT LU MY MT MX MA NP NL NZ NG NO OM PK PE PH PL PT QA RO RS SA SG SK SI ZA ES LK SE CH TW TZ TH TR UG UA AE GB US VN"
  .split(" ")
  .map((c) => ({ c, n: countryName(c) }))
  .sort((a, b) => a.n.localeCompare(b.n));

const TYPE_LABEL = { adult: "Adult", child: "Child", infant: "Infant" } as const;

function shiftYears(date: string, years: number) {
  const [y, m, d] = date.split("-");
  return `${+y + years}-${m}-${d}`;
}

export function PassengerForm({
  index,
  value,
  onChange,
  errors,
  international,
  lastDeparture,
  today,
}: {
  index: number;
  value: PaxForm;
  onChange: (p: PaxForm) => void;
  errors: Record<string, string>;
  international: boolean;
  lastDeparture: string;
  today: string;
}) {
  const id = `p${index}`;
  const e = (f: string) => errors[`${id}.${f}`];
  const set = (f: keyof PaxForm) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [f]: ev.target.value });
  const first = index === 0;
  const dob =
    value.type === "adult"
      ? { max: shiftYears(lastDeparture, -12) }
      : value.type === "child"
        ? { min: addDays(shiftYears(lastDeparture, -12), 1), max: shiftYears(lastDeparture, -2) }
        : { min: addDays(shiftYears(lastDeparture, -2), 1), max: today };
  // Advisory checks. They never block submission: the airline, not this form, decides.
  const advice = [
    ...nameIssues({ givenName: value.givenName, familyName: value.familyName }).map((i) => i.message),
    ...(international && value.passportExpiry ? [passportValidity(value.passportExpiry, lastDeparture)] : [])
      .filter((i) => "status" in i && (i.status === "fail" || i.status === "warn"))
      .map((i) => i.detail),
  ].filter((m, i, a) => a.indexOf(m) === i);
  const inv = (f: string) => (e(f) ? true : undefined);
  const desc = (f: string, hint?: boolean) => (e(f) ? `${id}-${f}-err` : hint ? `${id}-${f}-hint` : undefined);

  return (
    <fieldset className="rounded-md border border-line-2 bg-card p-5">
      <legend className="-ml-1 flex items-center gap-2 bg-card px-1 text-[16px] font-semibold tracking-tight">
        <span className="grid h-6 w-6 place-items-center rounded-xs bg-ink font-mono text-[12px] text-paper">{index + 1}</span>
        {TYPE_LABEL[value.type]}
        {value.type === "infant" && <span className="text-[12.5px] font-normal text-ink-3">· under 2, on an adult’s lap</span>}
      </legend>

      <div className="mt-3 grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
        <Field label="Title" htmlFor={`${id}-title`} error={e("title")}>
          <select id={`${id}-title`} className="input" value={value.title} onChange={set("title")} aria-invalid={inv("title")} aria-describedby={desc("title")} autoComplete={first ? "honorific-prefix" : "off"}>
            <option value="">Select</option>
            <option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option>
          </select>
        </Field>
        <Field label="First and middle names" htmlFor={`${id}-givenName`} error={e("givenName")} hint="Exactly as on the passport or ID">
          <input id={`${id}-givenName`} className="input" value={value.givenName} onChange={set("givenName")} aria-invalid={inv("givenName")} aria-describedby={desc("givenName", true)} autoComplete={first ? "given-name" : "off"} />
        </Field>
        <Field label="Last name" htmlFor={`${id}-familyName`} error={e("familyName")}>
          <input id={`${id}-familyName`} className="input" value={value.familyName} onChange={set("familyName")} aria-invalid={inv("familyName")} aria-describedby={desc("familyName")} autoComplete={first ? "family-name" : "off"} />
        </Field>
      </div>

      {advice.length > 0 && (
        <div className="mt-3 rounded-sm border border-[#d6b24a] bg-warn-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-warn" role="status">
          <p className="flex items-center gap-1.5 font-semibold"><IconAlert width={14} height={14} /> Check before you continue</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {advice.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-ink-3">You can still continue — but these are the mistakes that stop people at the gate.</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" htmlFor={`${id}-bornOn`} error={e("bornOn")} hint="Used to apply the right fare and age rules">
          <input id={`${id}-bornOn`} type="date" className="input" value={value.bornOn} onChange={set("bornOn")} {...dob} aria-invalid={inv("bornOn")} aria-describedby={desc("bornOn", true)} autoComplete={first ? "bday" : "off"} />
        </Field>
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-2" id={`${id}-gender-l`}>Gender on passport</p>
          <div role="radiogroup" aria-labelledby={`${id}-gender-l`} aria-describedby={desc("gender")} className="flex gap-2">
            {[["f", "Female"], ["m", "Male"]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={value.gender === v} onClick={() => onChange({ ...value, gender: v })} className={cn("h-11 flex-1 rounded-sm border text-[14px] font-semibold transition-colors", value.gender === v ? "border-ink bg-ink text-paper" : e("gender") ? "border-stop" : "border-line-2 hover:border-ink")}>
                {l}
              </button>
            ))}
          </div>
          {e("gender") && <p id={`${id}-gender-err`} className="mt-1 text-[12.5px] font-medium text-stop">{e("gender")}</p>}
          <p className="mt-1 text-[12px] text-ink-3">Airlines require it to match your travel document.</p>
        </div>
      </div>

      {international && (
        <div className="mt-5 rounded-sm border border-line bg-paper-2/60 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold"><IconLock width={15} height={15} /> Travel document</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Needed because this trip crosses a border: border authorities require it before you fly. Stored encrypted; shown masked after booking.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nationality" htmlFor={`${id}-nationality`} error={e("nationality")}>
              <select id={`${id}-nationality`} className="input" value={value.nationality} onChange={set("nationality")} aria-invalid={inv("nationality")} aria-describedby={desc("nationality")}>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => <option key={c.c} value={c.c}>{c.n}</option>)}
              </select>
            </Field>
            <Field label="Passport issuing country" htmlFor={`${id}-passportCountry`} error={e("passportCountry")}>
              <select id={`${id}-passportCountry`} className="input" value={value.passportCountry} onChange={set("passportCountry")} aria-invalid={inv("passportCountry")} aria-describedby={desc("passportCountry")}>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => <option key={c.c} value={c.c}>{c.n}</option>)}
              </select>
            </Field>
            <Field label="Passport number" htmlFor={`${id}-passportNumber`} error={e("passportNumber")}>
              <input id={`${id}-passportNumber`} className="input font-mono uppercase" value={value.passportNumber} onChange={set("passportNumber")} aria-invalid={inv("passportNumber")} aria-describedby={desc("passportNumber")} autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Passport expiry" htmlFor={`${id}-passportExpiry`} error={e("passportExpiry")} hint="Many countries need 6 months’ validity">
              <input id={`${id}-passportExpiry`} type="date" className="input" value={value.passportExpiry} min={lastDeparture} onChange={set("passportExpiry")} aria-invalid={inv("passportExpiry")} aria-describedby={desc("passportExpiry", true)} />
            </Field>
          </div>
        </div>
      )}
    </fieldset>
  );
}
