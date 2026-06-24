import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { assertPayable } from "@/lib/state-machine";
import { isShowcaseToken } from "@/lib/payment/showcase";
import Image from "next/image";
import BrandLogo from "@/components/brand-logo";
import TicketList from "@/components/ticket-list";
import ShowcaseDemo from "@/components/showcase-demo";

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

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const { token } = await params;

  // The reviewer's public demo is fully in-code (no DB row): render the
  // self-contained payment walkthrough and never touch prisma.
  if (isShowcaseToken(token)) {
    const { step } = await searchParams;
    return <ShowcaseDemo step={Array.isArray(step) ? step[0] : step} />;
  }

  const app = await prisma.application.findUnique({
    where: { payToken: token },
    include: { tickets: { orderBy: { createdAt: "asc" } } },
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
        <h1 className="font-display text-3xl font-semibold text-ink">Ödemeniz alındı</h1>
        <p className="mt-4 leading-relaxed text-moss">
          {config.eventName} biletleriniz hazır. Girişte her bilet için karekodu
          okutmanız yeterlidir. Etkinlikte görüşmek üzere!
        </p>

        {app.tickets.length > 0 && <TicketList tickets={app.tickets} />}

        {app.ticketsAccessToken && (
          <a
            href={`/tickets/${app.ticketsAccessToken}/pdf`}
            download="kindzi-fest-biletleri.pdf"
            className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
          >
            Biletleri İndir (PDF)
          </a>
        )}

        <p className="mt-4 text-xs leading-relaxed text-moss/70">
          Biletleriniz ayrıca e-posta ile gönderildi.
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
  const session = await getPaymentProvider().createCheckout({
    applicationId: app.id,
    amount,
    email: app.email,
    name: app.name,
    payToken: token,
  });

  // status is APPROVED here (PAID handled above). A stamped ticketsAccessToken
  // means the guest already chose "Kapıda öde" and holds a QR pass.
  const hasDoorPass = app.ticketsAccessToken != null;

  if (hasDoorPass) {
    return (
      <Shell>
        <p className="text-xs uppercase tracking-[0.28em] text-moss">
          {config.eventName}
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          Biletleriniz hazır
        </h1>

        <div className="mt-6 rounded-sm border border-hazel/30 bg-mist p-5">
          <p className="leading-relaxed text-moss">
            Girişte her bilet için karekodu okutun. Ödemeyi ({amount} TL) kapıda
            alacağız.
          </p>
        </div>

        {app.tickets.length > 0 && <TicketList tickets={app.tickets} />}

        {app.ticketsAccessToken && (
          <a
            href={`/tickets/${app.ticketsAccessToken}/pdf`}
            download="kindzi-fest-biletleri.pdf"
            className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
          >
            Biletleri İndir (PDF)
          </a>
        )}

        <a
          href={session.url}
          className="mt-3 inline-block w-full rounded-sm border border-ink/20 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-ink/5"
        >
          Şimdi öde
        </a>

        <p className="mt-4 text-xs leading-relaxed text-moss/70">
          Dilerseniz girişten önce online ödeyebilirsiniz. Biletleriniz ayrıca
          e-posta ile gönderildi.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-moss">
        {config.eventName}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
        Ödeme
      </h1>

      <div className="mt-8 rounded-sm border border-ink/10 bg-mist p-6">
        <p className="text-moss">{app.ticketQuantity} bilet</p>
        <p className="mt-1 font-display text-5xl font-semibold text-hazel">
          {amount} TL
        </p>
      </div>

      <a
        href={session.url}
        className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
      >
        Şimdi öde
      </a>

      <a
        href={`/pay/${token}/havale`}
        className="mt-3 inline-block w-full rounded-sm border border-ink/20 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-ink/5"
      >
        Havale / EFT ile öde
      </a>

      <p className="mt-4 text-xs leading-relaxed text-moss/70">
        &quot;Şimdi öde&quot; ile online ödeme güvenli sayfada tamamlanır.
        &quot;Havale / EFT ile öde&quot; ile hesabımıza transfer yaparsınız;
        ödemeniz onaylandıktan sonra biletleriniz e-posta ile gönderilir.
      </p>

      <p className="mt-3 text-xs leading-relaxed text-moss/70">
        Ödeme yaparak{" "}
        <a
          href="/mesafeli-satis-sozlesmesi"
          className="text-hazel underline underline-offset-4 hover:text-ink"
        >
          Mesafeli Satış Sözleşmesi
        </a>{" "}
        ve{" "}
        <a
          href="/teslimat-iade"
          className="text-hazel underline underline-offset-4 hover:text-ink"
        >
          Teslimat ve İade Şartları
        </a>
        &apos;nı kabul etmiş olursunuz. Biletler iade edilemez.
      </p>

      <Image
        src="/payment/iyzico-ile-ode.svg"
        alt="iyzico ile öde"
        width={210}
        height={31}
        className="mx-auto mt-6 h-auto w-[180px]"
      />
    </Shell>
  );
}
