import Image from "next/image";
import BrandLogo from "@/components/brand-logo";
import TicketList from "@/components/ticket-list";
import PaymentLogos from "@/components/payment-logos";
import { config } from "@/lib/config";
import { EVENT } from "@/lib/event";
import {
  SHOWCASE_PAY_TOKEN,
  SHOWCASE_DEMO,
  SHOWCASE_DEMO_TICKETS,
} from "@/lib/payment/showcase";

// A self-contained, database-free walkthrough of the full payment journey for
// the iyzico review team: order summary -> payment -> delivered tickets. No real
// charge is taken and nothing is persisted, so the link works on every deploy
// and survives re-reviews. Driven entirely by SHOWCASE_DEMO_* constants.

function DemoBanner() {
  return (
    <p className="mb-8 rounded-sm border border-hazel/30 bg-hazel/10 px-4 py-3 text-xs leading-relaxed text-hazel">
      Demo görünümü — {config.eventName} ödeme akışının önizlemesidir. Bu sayfada
      gerçek tahsilat yapılmaz; gösterilen bilgiler örnektir.
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="rise w-full max-w-md text-center">
        <BrandLogo size={120} priority className="mx-auto mb-8" />
        <DemoBanner />
        {children}
      </div>
    </main>
  );
}

function PayStep({ amount }: { amount: number }) {
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-moss">
        {config.eventName}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Ödeme</h1>

      <div className="mt-8 rounded-sm border border-ink/10 bg-mist p-6 text-left">
        <div className="flex items-center justify-between text-moss">
          <span>{EVENT.dateLabel} · {EVENT.city}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-moss">
          <span>{SHOWCASE_DEMO.ticketQuantity} bilet</span>
          <span>{config.ticketPrice} TL × {SHOWCASE_DEMO.ticketQuantity}</span>
        </div>
        <p className="mt-3 text-center font-display text-5xl font-semibold text-hazel">
          {amount} TL
        </p>
      </div>

      <a
        href={`/pay/${SHOWCASE_PAY_TOKEN}?step=received`}
        className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
      >
        Şimdi öde
      </a>

      <p className="mt-4 text-xs leading-relaxed text-moss/70">
        Gerçek alışverişte ödeme, iyzico güvenli ödeme sayfasında 3D Secure ile
        tamamlanır. Onaylandığında alıcıya e-posta ile bilet gönderilir.
      </p>

      <p className="mt-3 text-xs leading-relaxed text-moss/70">
        &quot;Şimdi öde&quot; diyerek{" "}
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

function ReceivedStep({ amount }: { amount: number }) {
  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold text-ink">
        Ödemeniz alındı
      </h1>
      <p className="mt-4 leading-relaxed text-moss">
        {config.eventName} biletleriniz hazır. Girişte her bilet için karekodu
        okutmanız yeterlidir. Etkinlikte görüşmek üzere!
      </p>

      <div className="mt-8 rounded-sm border border-ink/10 bg-mist p-5 text-left text-sm text-moss">
        <div className="flex items-center justify-between">
          <span>Tutar</span>
          <span className="font-medium text-ink">{amount} TL</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Referans</span>
          <span className="font-mono text-xs text-ink">{SHOWCASE_DEMO.paymentRef}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Bilet adedi</span>
          <span className="font-medium text-ink">{SHOWCASE_DEMO.ticketQuantity}</span>
        </div>
      </div>

      <TicketList tickets={SHOWCASE_DEMO_TICKETS} />

      <a
        href={`/tickets/${SHOWCASE_PAY_TOKEN}/pdf`}
        className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
      >
        Biletleri İndir (PDF)
      </a>

      <p className="mt-4 text-xs leading-relaxed text-moss/70">
        Biletler ayrıca alıcının e-postasına ve WhatsApp numarasına gönderilir.
      </p>

      <PaymentLogos className="mt-8" />

      <a
        href={`/pay/${SHOWCASE_PAY_TOKEN}`}
        className="mt-6 inline-block text-xs text-moss/60 underline underline-offset-4 hover:text-ink"
      >
        Akışı baştan görüntüle
      </a>
    </Shell>
  );
}

export default function ShowcaseDemo({ step }: { step?: string }) {
  const amount = SHOWCASE_DEMO.ticketQuantity * config.ticketPrice;
  return step === "received" ? (
    <ReceivedStep amount={amount} />
  ) : (
    <PayStep amount={amount} />
  );
}
