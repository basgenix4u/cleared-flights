"use client";

import { useState } from "react";
import { IconCheck } from "@/components/ui/icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard unavailable: the value stays selectable on screen */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-sm border border-line-2 px-2.5 py-1 text-[12px] font-semibold hover:border-ink"
      aria-label={label}
    >
      {done ? <><IconCheck width={13} height={13} className="text-go" /> Copied</> : "Copy"}
    </button>
  );
}
