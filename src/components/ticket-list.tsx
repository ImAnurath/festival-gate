import type { Ticket } from "@prisma/client";

/** Inline list of attendee tickets (one row each). Shared by the success and
 * retrieval pages. Presentational only — no QR (the PDF carries that). */
export default function TicketList({
  tickets,
}: {
  tickets: Pick<Ticket, "id" | "holderName" | "isBuyer" | "code">[];
}) {
  return (
    <ul className="mt-6 space-y-2 text-left">
      {tickets.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between rounded-sm border border-ink/10 bg-cream px-4 py-3"
        >
          <span>
            <span className="block font-display font-semibold text-ink">{t.holderName}</span>
            <span className="mt-0.5 block text-xs tracking-wide text-hazel">{t.code}</span>
          </span>
          <span className="rounded-full border border-sea/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-sea">
            {t.isBuyer ? "Sahibi" : "Misafir"}
          </span>
        </li>
      ))}
    </ul>
  );
}
