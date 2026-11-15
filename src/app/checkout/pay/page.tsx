import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PayNow } from "@/components/checkout/PayNow";
import { IconLock } from "@/components/ui/icons";
import { getBookingRow } from "@/lib/booking-service";
import { configuredProviderId, paymentProvider } from "@/lib/payments";
import { fmtMoney } from "@/lib/format";
import { verifyPaymentToken } from "@/lib/security";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ ref?: string; token?: string }> }) {
  const { ref, token } = await searchParams;
  if (!ref || !token) notFound();
  const reference = ref.toUpperCase();
  if (!verifyPaymentToken(reference, token)) notFound();

  const booking = await getBookingRow(reference);
  if (!booking) notFound();

  const provider = paymentProvider();
  const paid = booking.paymentStatus === "paid";

  return (
    <div className="mx-auto max-w-[560px] px-4 py-14">
      <div className="rounded-md border-[1.5px] border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
        <p className="eyebrow">Payment</p>
        <h1 className="mt-2 text-[26px] font-bold tracking-[-0.03em]">
          {paid ? "Already paid" : "One step left"}
        </h1>
        <p className="mt-1 font-mono text-[12px] text-ink-3">Booking {reference}</p>

        <dl className="mt-5 space-y-2 border-y border-line py-4 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">Amount due</dt>
            <dd className="num font-mono text-[16px] font-semibold">{fmtMoney(Number(booking.totalAmount), booking.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Passengers</dt>
            <dd className="num font-mono">{booking.passengerCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Reference</dt>
            <dd className="font-mono">{booking.reference}</dd>
          </div>
        </dl>

        <div className="mt-5">
          {paid ? (
            <Link href={`/trips/${reference}?new=1`} className="inline-flex h-11 w-full items-center justify-center rounded-sm border border-ink bg-signal text-[14px] font-semibold hover:bg-ink hover:text-signal">
              View your booking
            </Link>
          ) : provider ? (
            <PayNow
              reference={reference}
              token={token}
              amountLabel={fmtMoney(Number(booking.totalAmount), booking.currency)}
              providerLabel={provider.label}
              isMock={configuredProviderId() === "mock"}
            />
          ) : (
            <p className="rounded-sm border border-[#d6b24a] bg-warn-bg px-3 py-2 text-[13px] text-warn">
              Payments are not configured on this deployment, so this booking cannot be completed. Nothing has been charged.
            </p>
          )}
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
          <IconLock width={13} height={13} className="mt-[1px] shrink-0" />
          Card details are entered on the provider&apos;s own page and never pass through Cleared. We only receive the result of the payment.
        </p>
      </div>
    </div>
  );
}
