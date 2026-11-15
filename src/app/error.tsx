"use client";

import { Button, ButtonLink } from "@/components/ui/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-[28px] font-bold tracking-[-0.03em]">We hit turbulence on our side</h1>
      <p className="mt-2 text-ink-3">Nothing was charged. Try again, or head back to the start.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="signal" onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">Home</ButtonLink>
      </div>
    </div>
  );
}
