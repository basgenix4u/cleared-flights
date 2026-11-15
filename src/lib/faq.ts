export interface Faq {
  q: string;
  a: string;
  topic: "Search" | "Booking" | "Payments" | "Baggage" | "Tickets" | "Changes" | "Support";
}

export const FAQS: Faq[] = [
  { topic: "Search", q: "What does the price on a result include?", a: "The airline fare, taxes, carrier-imposed surcharges and our per-traveller service fee. Optional extras such as checked bags and seats are never in the headline price; they are listed separately, with their own prices, during checkout." },
  { topic: "Search", q: "Why does a fare sometimes change or disappear?", a: "Airlines update availability continuously and every fare has an expiry time. We re-check the fare when you open checkout and again immediately before booking. If the price moved, we show the old and new total and ask you to accept it. We never silently charge more." },
  { topic: "Booking", q: "Do I need an account to book?", a: "No. You book as a guest. Afterwards, your booking reference and a passenger surname give you access to your trip on any device." },
  { topic: "Tickets", q: "How will I know my ticket is really issued?", a: "Every booking shows one of three honest states. Requested means we have your order. Reserved means the airline has created a reservation. Ticketed means ticket numbers exist. We only display a ticket as issued when the ticket numbers have actually been returned." },
  { topic: "Baggage", q: "How do I know what baggage is included?", a: "Each fare shows its cabin and checked bag allowance as supplied by the airline. If the airline did not state it, we say “not stated” rather than guess. Extra bags can be added in checkout at the price offered for your flight." },
  { topic: "Payments", q: "How is payment handled?", a: "We never store card numbers. Card entry is meant to be handled by a hosted payment provider. This build runs in a clearly labelled simulation until a provider is connected, so nothing is charged." },
  { topic: "Changes", q: "Can I cancel or change my booking?", a: "That depends on the fare rules, which are shown on the fare and again before you pay. From Manage booking you can get a cancellation quote that states the refund before you confirm. Our service fee is non-refundable. Change requests are reviewed by our support team." },
  { topic: "Changes", q: "What happens to my refund?", a: "The refund amount is whatever the airline's rules and quote allow. We show it before you confirm and record it on the booking." },
  { topic: "Support", q: "Is this showing real flights?", a: "Only when a flight provider is connected. Without one, Cleared runs in demo mode: schedules, carriers and prices are synthetic, marked with a hazard-striped DEMO label, and nothing can be ticketed." },
];
