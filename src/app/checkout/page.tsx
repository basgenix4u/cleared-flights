import type { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { EmptyState, ButtonLink } from "@/components/ui/ui";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = typeof sp.session === "string" ? sp.session : "";
  const offer = typeof sp.offer === "string" ? sp.offer : "";
  if (!/^[0-9a-f-]{36}$/i.test(session) || !offer)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="Choose a flight first" actions={<ButtonLink href="/#search" variant="signal">Search flights</ButtonLink>}>
          Checkout opens from a fare on the results page, so we can re-check its price with the airline.
        </EmptyState>
      </div>
    );
  return <CheckoutClient sessionId={session} offerId={offer} />;
}
