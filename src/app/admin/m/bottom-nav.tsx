"use client";

import { usePathname } from "next/navigation";

// Inline line icons (stroke = currentColor) so the tab bar inherits the active
// color without shipping an icon dependency.
function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

// scan / people / door / chart
const ICONS = {
  scan: "M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16",
  people:
    "M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18.5 19c0-1.6-.8-3-2-3.7M5.5 19c0-1.6.8-3 2-3.7",
  door: "M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M3 21h18M12.5 12v1",
  chart: "M5 21V10M12 21V4M19 21v-7",
};

const tabs = [
  { href: "/admin/m/scan", label: "Tara", icon: ICONS.scan },
  { href: "/admin/m/guests", label: "Misafirler", icon: ICONS.people },
  { href: "/admin/m/door", label: "Kapı", icon: ICONS.door },
  { href: "/admin/m/stats", label: "Sayım", icon: ICONS.chart },
];

// App-style bottom tab bar. Highlights the active tab (ink + a hazel top accent),
// keeps large tap targets, and reserves the phone's bottom safe-area inset so the
// row clears the home indicator when installed.
export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink/10 bg-mist pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-ink/5 ${
              active ? "text-ink" : "text-moss/70"
            }`}
          >
            {active && (
              <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-hazel" />
            )}
            <Icon d={t.icon} />
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
