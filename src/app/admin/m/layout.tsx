import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "KF Admin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "KF Admin", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#16332a",
};

const tabs = [
  { href: "/admin/m/scan", label: "Tara" },
  { href: "/admin/m/guests", label: "Misafirler" },
  { href: "/admin/m/door", label: "Kapı" },
  { href: "/admin/m/stats", label: "Sayım" },
];

// Server layout: the single admin guard for every /admin/m/* screen. Renders a
// fixed bottom tab bar (no active-state highlight; kept a server component so the
// guard stays here). Child pages do not re-check the session.
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
      <div className="flex-1 pb-20">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink/10 bg-mist">
        {tabs.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="flex items-center justify-center py-4 text-sm font-medium text-ink"
          >
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
