import { config } from "@/lib/config";
import { loadTicketsByAccessToken } from "@/lib/tickets";
import TicketList from "@/components/ticket-list";
import BrandLogo from "@/components/brand-logo";
import { MOTTO_PICKUP } from "@/lib/venue";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="rise w-full max-w-md text-center">
        <BrandLogo size={120} priority className="mx-auto mb-8" />
        {children}
      </div>
    </main>
  );
}

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await loadTicketsByAccessToken(token);

  if (view.kind === "notfound") {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">Geçersiz bağlantı</h1>
        <p className="mt-4 leading-relaxed text-moss">
          Bu bilet bağlantısı geçerli değil. Lütfen bağlantıyı kontrol edin.
        </p>
      </Shell>
    );
  }

  if (view.kind === "expired") {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">Etkinlik sona erdi</h1>
        <p className="mt-4 leading-relaxed text-moss">
          {config.eventName} sona erdiği için biletler artık görüntülenemiyor.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-moss">{config.eventName}</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Biletleriniz</h1>
      <p className="mt-3 leading-relaxed text-moss">
        Girişte her bilet için karekodu okutmanız yeterlidir.
      </p>

      {view.application.paidAt == null && (
        <div className="mt-4 rounded-sm border border-hazel/30 bg-mist p-4 text-left">
          <p className="text-sm leading-relaxed text-moss">
            Ödemeyi girişte yapacaksınız. Dilerseniz fiziksel biletinizi şu
            adresten de alabilirsiniz: {MOTTO_PICKUP}
          </p>
        </div>
      )}

      <TicketList tickets={view.tickets} />

      <a
        href={`/tickets/${token}/pdf`}
        download="kindzi-fest-biletleri.pdf"
        className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
      >
        Biletleri İndir (PDF)
      </a>
    </Shell>
  );
}
