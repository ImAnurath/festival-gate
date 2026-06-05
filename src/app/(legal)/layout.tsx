import Link from "next/link";
import SiteFooter from "@/components/site-footer";

/**
 * Shared chrome for the legally required pages (Hakkımızda, Gizlilik, Mesafeli
 * Satış, Teslimat & İade). The `(legal)` route group keeps these at top-level
 * URLs (/hakkimizda, /gizlilik, ...) while sharing one layout. Page files only
 * provide semantic HTML; typography is styled here via descendant selectors.
 */
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 pt-12 pb-20">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-moss/70 transition-colors hover:text-ink"
        >
          ← Ana sayfa
        </Link>

        <article
          className="rise mt-8 text-moss
            [&_h1]:font-display [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-ink
            [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink
            [&_h2]:scroll-mt-12
            [&_p]:mt-4 [&_p]:leading-relaxed
            [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
            [&_li]:leading-relaxed
            [&_a]:text-hazel [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-ink
            [&_strong]:font-semibold [&_strong]:text-ink
            [&_dl]:mt-4 [&_dt]:mt-3 [&_dt]:font-semibold [&_dt]:text-ink [&_dd]:leading-relaxed"
        >
          {children}
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}
