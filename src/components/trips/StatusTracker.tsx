import type { BookingView } from "@/lib/booking-service";
import { cn } from "@/components/ui/cn";
import { IconCheck, IconClose } from "@/components/ui/icons";

type NodeState = "done" | "current" | "pending" | "simulated" | "off";

export const STATUS_COPY: Record<BookingView["status"], { title: string; body: string }> = {
  simulated: { title: "Demo booking recorded", body: "This is a simulation. No airline reservation exists, no ticket has been issued and nothing was charged. It is stored so you can try managing a booking." },
  requested: { title: "Booking requested", body: "We have your order and are waiting for the airline to confirm it. This page updates when the status changes; reload to check." },
  confirmed: { title: "Reserved with the airline", body: "The airline has created a reservation (reference below). Ticket numbers haven’t been issued yet. They appear here once they exist." },
  ticketed: { title: "Ticketed", body: "Your ticket is issued. The ticket numbers are below. Keep them for check-in and any airline enquiry." },
  cancelled: { title: "Booking cancelled", body: "This booking is cancelled. Refund details are below." },
  failed: { title: "Booking failed", body: "This booking did not complete and nothing was charged." },
};

export function StatusTracker({ status }: { status: BookingView["status"] }) {
  const states: Record<BookingView["status"], NodeState[]> = {
    simulated: ["done", "simulated", "simulated"],
    requested: ["current", "pending", "pending"],
    confirmed: ["done", "done", "pending"],
    ticketed: ["done", "done", "done"],
    cancelled: ["done", "off", "off"],
    failed: ["off", "off", "off"],
  };
  const labels = [
    ["Requested", "Order received"],
    ["Reserved", "Airline reservation"],
    ["Ticketed", "Ticket numbers issued"],
  ];
  const s = states[status];
  return (
    <ol className="grid grid-cols-3 gap-0" aria-label="Booking status">
      {labels.map(([t, sub], i) => (
        <li key={t} className="relative pr-2">
          <div className="flex items-center">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[12px]",
                s[i] === "done" && "border-go bg-go text-white",
                s[i] === "current" && "border-ink bg-signal text-ink",
                s[i] === "pending" && "border-line-2 text-ink-3",
                s[i] === "simulated" && "border-dashed border-ink bg-card text-ink",
                s[i] === "off" && "border-line-2 bg-paper-2 text-ink-3",
              )}
            >
              {s[i] === "done" ? <IconCheck width={16} height={16} /> : s[i] === "off" ? <IconClose width={14} height={14} /> : i + 1}
            </span>
            {i < 2 && <span className={cn("ml-2 h-[1.5px] flex-1", s[i] === "done" && s[i + 1] === "done" ? "bg-go" : "bg-line-2")} aria-hidden />}
          </div>
          <p className="mt-2 text-[14px] font-semibold">{t}</p>
          <p className="text-[12px] text-ink-3">
            {s[i] === "simulated" ? "Simulated (demo)" : s[i] === "off" ? "Not applicable" : s[i] === "pending" ? "Not yet" : sub}
          </p>
        </li>
      ))}
    </ol>
  );
}
