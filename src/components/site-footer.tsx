import BrandLogo from "@/components/brand-logo";
import PaymentLogos from "@/components/payment-logos";
import { EVENT } from "@/lib/event";

const legalLinks = [
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { href: "/teslimat-iade", label: "Teslimat ve İade" },
  { href: "/gizlilik", label: "Gizlilik Sözleşmesi" },
];

/**
 * Shared site footer. Carries the legally required links (about, distance-sales
 * agreement, delivery & refund, privacy) and the iyzico/Visa/Mastercard payment
 * logos that iyzico requires to be visible on the site.
 */
export default function SiteFooter() {
  return (
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

        <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
          {legalLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-moss/80 underline-offset-4 hover:text-ink hover:underline"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <PaymentLogos className="mt-6" />

        <p className="mt-5 max-w-md text-xs leading-relaxed text-moss/70">
          Başvuru bilgileriniz yalnızca etkinlik girişi için saklanır ve
          etkinlik sonrasında silinir.
        </p>
        <a
          href="/admin"
          className="mt-4 text-[0.7rem] uppercase tracking-[0.2em] text-moss/40 transition-colors hover:text-moss"
        >
          Yönetim
        </a>
      </div>
    </footer>
  );
}
