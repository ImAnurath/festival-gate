import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { assertPayable } from "@/lib/state-machine";
import { Hazelnut } from "@/components/ornaments";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="rise w-full max-w-md text-center">{children}</div>
    </main>
  );
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const app = await prisma.application.findUnique({ where: { payToken: token } });

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
        <Hazelnut className="mx-auto h-10 w-10 text-hazel" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
          Ödemeniz alındı
        </h1>
        <p className="mt-4 leading-relaxed text-moss">
          {config.eventName} biletleriniz hazır. Girişte kimliğinizi yanınızda
          bulundurun. Etkinlikte görüşmek üzere!
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
    payToken: token,
  });

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

      <p className="mt-4 text-xs leading-relaxed text-moss/70">
        Ödeme güvenli sayfada tamamlanır. Onaylandığında size bir e-posta
        gönderilir.
      </p>
    </Shell>
  );
}
