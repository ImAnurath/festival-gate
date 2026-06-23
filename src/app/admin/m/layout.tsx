import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SwRegister from "./sw-register";
import BottomNav from "./bottom-nav";

export const metadata: Metadata = {
  title: "KF Admin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "KF Admin", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

// viewportFit "cover" lets the safe-area-inset env() values resolve to real
// notch / home-indicator sizes on installed phones.
export const viewport: Viewport = {
  themeColor: "#16332a",
  viewportFit: "cover",
};

// Server layout: the single admin guard for every /admin/m/* screen. Renders a
// safe-area-aware header plus the client BottomNav (which owns active-tab state).
// Child pages do not re-check the session.
export default async function MobileAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.adminId) redirect("/admin/login");

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <SwRegister />
      <header className="flex items-center justify-between border-b border-ink/10 bg-mist px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <a
          href="/admin"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5 active:bg-ink/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Başvurular
        </a>
        <span className="font-display text-sm font-semibold tracking-wide text-ink">
          KİNDZİ FEST
        </span>
      </header>
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </div>
  );
}
