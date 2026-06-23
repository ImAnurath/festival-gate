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
          className="-m-2 p-2 text-sm text-moss transition-colors hover:text-ink"
        >
          &larr; Başvurular
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
