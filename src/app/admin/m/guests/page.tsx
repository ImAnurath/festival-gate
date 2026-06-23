import { searchAttendeeApplications } from "@/lib/applications";
import CheckInButton from "./check-in-button";

export const dynamic = "force-dynamic";

export default async function MobileGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const apps = await searchAttendeeApplications(query);

  return (
    <main className="px-4 py-6">
      <h1 className="font-display text-xl font-semibold text-ink">Misafirler</h1>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="İsimle ara"
          className="field w-full"
        />
      </form>

      <ul className="mt-4 space-y-3">
        {apps.length === 0 && (
          <li className="py-12 text-center text-moss">Sonuç yok.</li>
        )}
        {apps.map((a) => {
          const total = a.tickets.length;
          const inCount = a.tickets.filter((t) => t.status === "USED").length;
          return (
            <li key={a.id} className="rounded-sm border border-ink/10 bg-mist p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{a.name}</span>
                <span className="text-xs text-moss">
                  {inCount}/{total} girdi{a.status !== "PAID" ? " · Ödenmedi" : ""}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-ink/5">
                {a.tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm text-ink">
                      {t.holderName} <span className="text-moss">{t.code}</span>
                    </span>
                    {t.status === "USED" ? (
                      <span className="text-xs text-moss">Giriş yapıldı</span>
                    ) : (
                      <CheckInButton token={t.verifyToken} />
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
