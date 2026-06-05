import { config } from "@/lib/config";
import { EVENT } from "@/lib/event";
import ApplyForm from "./apply-form";
import Gallery from "@/components/gallery";
import Reveal from "@/components/reveal";
import BrandLogo from "@/components/brand-logo";
import { YaylaRidges, Divider } from "@/components/ornaments";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;

  if (submitted) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="rise max-w-xl text-center">
          <BrandLogo size={150} className="mx-auto" />
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-ink">
            Başvurunuz alındı
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-moss">
            {EVENT.name} için başvurunuz bize ulaştı. Başvurular tek tek
            değerlendiriliyor. Onaylanırsanız, biletlerinizi almanız için size
            e-posta ile bir bağlantı göndereceğiz.
          </p>
          <p className="mt-8 text-sm uppercase tracking-[0.2em] text-moss/70">
            {EVENT.presenter} · {EVENT.city}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center sm:pt-20">
        <BrandLogo size={180} priority className="rise mx-auto" />

        <h1
          className="rise mt-6 font-display text-6xl font-semibold leading-[0.92] tracking-tight text-ink sm:text-8xl"
          style={{ animationDelay: "0.08s" }}
        >
          KİNDZİ
          <span className="block text-hazel">FEST</span>
        </h1>

        <p
          className="rise mx-auto mt-7 max-w-xl text-lg leading-relaxed text-moss"
          style={{ animationDelay: "0.16s" }}
        >
          {EVENT.tagline}
        </p>

        <div
          className="rise mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-display text-xl text-ink"
          style={{ animationDelay: "0.24s" }}
        >
          <span className="border-b-2 border-hazel pb-0.5">{EVENT.dateLabel}</span>
          <span className="text-moss/50">·</span>
          <span>{EVENT.dayLabel}</span>
          <span className="text-moss/50">·</span>
          <span>{EVENT.city}</span>
        </div>

        <div
          className="rise mt-10"
          style={{ animationDelay: "0.32s" }}
        >
          <a
            href="#basvuru"
            className="inline-block rounded-sm bg-ink px-7 py-3 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
          >
            Başvur
          </a>
        </div>

        <YaylaRidges className="rise mx-auto mt-14 w-full max-w-2xl text-ink" />
      </section>

      {/* ---------- Program ---------- */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Divider />
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          {EVENT.program.map((p, i) => (
            <Reveal key={p.key} delay={i * 120}>
              <p className="text-xs uppercase tracking-[0.28em] text-hazel">
                {p.kicker}
              </p>
              <p className="mt-3 font-display text-2xl text-ink">{p.time}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{p.title}</h2>
              <p className="mt-2 leading-relaxed text-moss">{p.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Venue gallery ---------- */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Reveal>
          <p className="text-center text-xs uppercase tracking-[0.28em] text-moss">
            Deniz&apos;in Yeri&apos;nden
          </p>
          <p className="mt-2 text-center text-sm text-moss/70">
            Büyütmek için bir fotoğrafa dokunun
          </p>
          <div className="mt-8">
            <Gallery images={EVENT.gallery} />
          </div>
        </Reveal>
      </section>

      {/* ---------- Application ---------- */}
      <section
        id="basvuru"
        className="mx-auto max-w-xl scroll-mt-12 px-6 pb-24 pt-12"
      >
        <Divider className="mb-12" />
        <Reveal>
          <h2 className="font-display text-4xl font-semibold tracking-tight text-ink">
            Başvuru
          </h2>
          <p className="mt-4 leading-relaxed text-moss">
            {EVENT.name} katılımı başvuru ile olur. Ad, e-posta ve herkese açık
            sosyal medya hesabınızı bırakın. Başvurunuz değerlendirildikten sonra
            onaylanırsanız, bilet alım bağlantınız e-posta ile gönderilir. Tek bir
            başvuruyla yanınızdaki misafirler için de bilet alabilirsiniz.
          </p>
          <p className="mt-3 text-sm text-moss/80">
            Bilet ücreti: <span className="font-semibold text-ink">{config.ticketPrice} TL</span> (kişi başı)
          </p>

          <div className="mt-8">
            <ApplyForm maxTickets={config.maxTicketsPerBuyer} />
          </div>
        </Reveal>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-ink/10 px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center text-sm text-moss">
          <BrandLogo size={120} className="mx-auto" />
          <p>{EVENT.city}</p>
          <a
            href={EVENT.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-hazel underline underline-offset-4 hover:text-ink"
          >
            Instagram
          </a>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-moss/70">
            Başvuru bilgileriniz yalnızca etkinlik girişi için saklanır ve
            etkinlik sonrasında silinir.
          </p>
        </div>
      </footer>
    </main>
  );
}
