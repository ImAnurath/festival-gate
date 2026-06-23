import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { searchApprovedApplications } from "@/lib/applications";
import { markPaidAtDoorAction, undoDoorPaymentAction } from "@/app/admin/door/actions";

export const dynamic = "force-dynamic";

export default async function MobileDoorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const pending = await searchApprovedApplications(query);
  const collected = await prisma.application.findMany({
    where: { status: "PAID", paymentRef: "door-pos" },
    orderBy: { paidAt: "desc" },
    take: 20,
  });

  return (
    <main className="px-4 py-6">
      <h1 className="font-display text-xl font-semibold text-ink">Kapı tahsilatı</h1>
      <p className="mt-1 text-sm text-moss">
        Misafiri POS cihazından tahsil edin, sonra düğmeye dokunun.
      </p>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="İsimle ara"
          className="w-full rounded-sm border border-ink/20 px-3 py-2.5 text-base"
        />
      </form>

      <ul className="mt-4 space-y-2">
        {pending.length === 0 && (
          <li className="py-12 text-center text-moss">Bekleyen onaylı başvuru yok.</li>
        )}
        {pending.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-sm border border-ink/10 bg-mist p-3"
          >
            <div>
              <p className="font-medium text-ink">
                {a.name}
                {a.ticketsAccessToken != null && (
                  <span className="ml-2 rounded-sm border border-ink/10 bg-cream-deep px-1.5 py-0.5 text-xs font-normal text-moss">
                    Karekod var
                  </span>
                )}
              </p>
              <p className="text-xs text-moss">
                {a.ticketQuantity} bilet · {a.ticketQuantity * config.ticketPrice} TL
              </p>
            </div>
            <form action={markPaidAtDoorAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className="min-h-[40px] rounded-sm bg-sea px-5 py-2 text-sm font-medium text-cream transition-opacity active:opacity-80">
                Ödendi
              </button>
            </form>
          </li>
        ))}
      </ul>

      {collected.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-moss">
            Kapıda tahsil edilenler
          </h2>
          <ul className="mt-3 space-y-2">
            {collected.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-sm border border-ink/10 px-3 py-2.5"
              >
                <span className="text-sm text-ink">
                  {a.name}
                  <span className="ml-2 text-moss">
                    {a.amount ?? a.ticketQuantity * config.ticketPrice} TL
                  </span>
                </span>
                <form action={undoDoorPaymentAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="min-h-[40px] rounded-sm border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 transition-colors active:bg-ink/5">
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
