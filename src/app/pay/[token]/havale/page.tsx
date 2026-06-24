import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { assertPayable } from "@/lib/state-machine";
import BrandLogo from "@/components/brand-logo";
import CopyLink from "@/components/copy-link";

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

export default async function HavalePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const app = await prisma.application.findUnique({
    where: { payToken: token },
  });

  if (!app) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Geçersiz bağlantı
        </h1>
        <p className="mt-4 leading-relaxed text-moss">
          Bu ödeme bağlantısı geçerli değil. Lütfen bağlantıyı kontrol edin.
        </p>
      </Shell>
    );
  }

  if (app.status === "PAID") {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Ödemeniz alındı
        </h1>
        <p className="mt-4 leading-relaxed text-moss">
          Biletleriniz e-posta ile gönderildi. Etkinlikte görüşmek üzere!
        </p>
      </Shell>
    );
  }

  try {
    assertPayable(app, new Date());
  } catch {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Bağlantının süresi doldu
        </h1>
        <p className="mt-4 leading-relaxed text-moss">
          Bu ödeme bağlantısının süresi dolmuş. Lütfen organizatörle iletişime
          geçin.
        </p>
      </Shell>
    );
  }

  const amount = app.ticketQuantity * config.ticketPrice;
  // Strip base64url's "-"/"_" so the reference is plain A-Z/0-9 (no symbols for
  // the buyer to type into the transfer description).
  const reference = token.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-moss">
        {config.eventName}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
        Havale / EFT
      </h1>

      <div className="mt-8 rounded-sm border border-ink/10 bg-mist p-6 text-left">
        <p className="text-center text-moss">{app.ticketQuantity} bilet</p>
        <p className="mt-1 text-center font-display text-5xl font-semibold text-hazel">
          {amount} TL
        </p>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-moss">
              Alıcı
            </dt>
            <dd className="mt-1 font-medium text-ink">{config.havaleAccountName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-moss">Banka</dt>
            <dd className="mt-1 font-medium text-ink">{config.havaleBankName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-moss">IBAN</dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-ink">{config.havaleIban}</span>
              <CopyLink url={config.havaleIban} label="IBAN'ı kopyala" />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-moss">
              Açıklama (referans)
            </dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-ink">{reference}</span>
              <CopyLink url={reference} label="Kopyala" />
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-moss/70">
        Lütfen tam tutarı yukarıdaki IBAN&apos;a gönderin ve açıklama kısmına{" "}
        <span className="font-medium text-ink">{reference}</span> referans kodunu
        yazın. Ödemeniz onaylandıktan sonra biletleriniz e-posta ile
        gönderilecektir.
      </p>

      <a
        href={`/pay/${token}`}
        className="mt-8 inline-block text-sm text-hazel underline underline-offset-4 hover:text-ink"
      >
        Geri dön
      </a>
    </Shell>
  );
}
