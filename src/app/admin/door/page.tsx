import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getSession } from "@/lib/session";
import { markPaidAtDoorAction, undoDoorPaymentAction } from "./actions";
import { searchApprovedApplications } from "@/lib/applications";

// Door collection screen. Staff charge the guest on the bank POS terminal, then
// tap "Ödendi (POS)" to mark the application paid (no ticket, no notification).
// A small "Geri al" reverts a mistaken tap. Approved-unpaid applicants are
// name-searchable; door-collected applicants are listed below for undo.
export default async function DoorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session.adminId) redirect("/admin/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const pending = await searchApprovedApplications(query);

  const collected = await prisma.application.findMany({
    where: { status: "PAID", paymentRef: "door-pos" },
    orderBy: { paidAt: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Kapı tahsilatı</h1>
        <a
          href="/admin"
          className="rounded-sm px-3 py-2 text-sm text-moss transition-colors hover:text-ink"
        >
          Başvurulara dön
        </a>
      </div>
      <p className="mt-2 text-sm text-moss">
        Misafiri POS cihazından tahsil edin, ardından adının yanındaki düğmeye dokunun.
      </p>

      <form method="get" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="İsimle ara"
          className="w-full rounded-sm border border-ink/20 px-3 py-2 text-sm"
        />
      </form>

      <section className="mt-6 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-cream-deep text-left text-xs uppercase tracking-wider text-moss">
            <tr>
              <th className="px-4 py-3 font-medium">Ad</th>
              <th className="px-4 py-3 font-medium">Adet</th>
              <th className="px-4 py-3 font-medium">Tutar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-moss">
                  Bekleyen onaylı başvuru yok.
                </td>
              </tr>
            )}
            {pending.map((a) => (
              <tr key={a.id} className="border-t border-ink/10">
                <td className="px-4 py-3 font-medium text-ink">
                  {a.name}
                  {a.ticketsAccessToken != null && (
                    <span className="ml-2 inline-block rounded-sm border border-ink/10 bg-cream-deep px-1.5 py-0.5 text-xs font-normal text-moss">
                      Karekod var
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">{a.ticketQuantity}</td>
                <td className="px-4 py-3 text-ink">
                  {a.ticketQuantity * config.ticketPrice} TL
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={markPaidAtDoorAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="rounded-sm bg-sea px-3 py-1.5 text-xs font-medium text-cream transition-opacity hover:opacity-90">
                      Ödendi (POS)
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {collected.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-moss">
            Kapıda tahsil edilenler
          </h2>
          <ul className="mt-3 divide-y divide-ink/10 rounded-sm border border-ink/10">
            {collected.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-ink">
                  {a.name}
                  <span className="ml-2 text-moss">
                    {a.amount ?? a.ticketQuantity * config.ticketPrice} TL
                  </span>
                </span>
                <form action={undoDoorPaymentAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5">
                    Geri al
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
