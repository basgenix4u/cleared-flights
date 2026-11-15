import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingRow } from "@/lib/booking-service";
import { paymentFor } from "@/lib/payment-service";

export const metadata: Metadata = { title: "Payment result", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Where the provider sends the customer back.
 *
 * This page never marks anything as paid — the webhook does that. If the webhook has not
 * arrived yet the page says "confirming", which is the truth, and refreshes itself.
 */
export default async function PayCallback({ searchParams }: { searchParams: Promise<{ ref?: string; status?: string }> }) {
  const { ref, status } = await searchParams;
  if (!ref) notFound();
  const reference = ref.toUpperCase();

  const [booking, payment] = await Promise.all([getBookingRow(reference), paymentFor(reference)]);
  if (!booking) notFound();

  const captured = payment?.status === "captured";
  const fulfilled = payment?.fulfilmentStatus === "done";
  const failedFulfilment = payment?.fulfilmentStatus === "failed";
  const cancelled = status === "cancelled";

  const headline = cancelled
    ? "Payment cancelled"
    : captured && fulfilled
      ? "Payment received"
      : captured
        ? "Payment received — confirming your ticket"
        : "Confirming your payment";

  const body = cancelled
    ? "Nothing was charged. The booking is still open, so you can pay whenever you are ready."
    : captured && fulfilled
      ? "We have your payment and the airline has confirmed your booking. Your reference is below."
      : captured
        ? "We have your payment. The airline reservation is still being created — this page refreshes itself, and we retry automatically if it fails."
        : "We are waiting for the payment provider to confirm. This usually takes seconds.";

  return (
    <div className="mx-auto max-w-[560px] px-4 py-14">
      <div className="rounded-md border-[1.5px] border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
        <p className="eyebrow">Booking {reference}</p>
        <h1 className="mt-2 text-[26px] font-bold tracking-[-0.03em]">{headline}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>

        {paidBadge(captured, failedFulfilment) && (
          <div className="mt-4 rounded-sm border border-line-2 bg-paper-2/60 p-3 font-mono text-[11.5px]">
            payment: {payment?.status} · fulfilment: {payment?.fulfilmentStatus}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/trips/${reference}`} className="inline-flex h-11 items-center rounded-sm border border-ink bg-signal px-5 text-[14px] font-semibold hover:bg-ink hover:text-signal">
            View your booking
          </Link>
          {!captured && !cancelled && (
            <Link href={`/checkout/pay/callback?ref=${reference}`} className="inline-flex h-11 items-center rounded-sm border border-line-2 px-5 text-[14px] font-semibold hover:border-ink">
              Check again
            </Link>
          )}
        </div>

        {failedFulfilment && (
          <p className="mt-4 rounded-sm border border-[#d6b24a] bg-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-warn">
            Your payment went through but the airline did not confirm the reservation. We retry automatically, and if it cannot be
            completed you are refunded in full without having to ask.
          </p>
        )}
      </div>
    </div>
  );
}

function paidBadge(captured: boolean, failed: boolean) {
  return captured || failed;
}
