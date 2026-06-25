import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getSession } from "@/lib/session";
import {
  approveAction,
  rejectAction,
  resendLinkAction,
  confirmHavaleAction,
  undoHavaleAction,
  giveGatePassAction,
  revokeGatePassAction,
} from "./actions";
import CopyLink from "@/components/copy-link";
import BrandLogo from "@/components/brand-logo";
import { havaleReference } from "@/lib/token";
import type { Application } from "@prisma/client";

const STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  PAID: "Ödendi",
  REJECTED: "Reddedildi",
};

const STATUS_CLASSES: Record<(typeof STATUSES)[number], string> = {
  PENDING: "bg-moss/10 text-moss",
  APPROVED: "bg-sea/10 text-sea",
  PAID: "bg-hazel/10 text-hazel",
  REJECTED: "bg-ink/10 text-ink/60",
};

// Consistent button styling shared by the table and the cards: filled = primary
// action for the row's state, outlined = secondary.
const BTN_PRIMARY =
  "rounded-sm px-3 py-1.5 text-xs font-medium text-cream transition-opacity hover:opacity-90";
const BTN_SECONDARY =
  "rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5";

// Buyer + named guests as one display string, "-" when no guests. Shared by the
// desktop table cell (truncated) and the mobile card (full).
function formatGuests(a: Application): string {
  const names = JSON.parse(a.guestNames) as string[];
  const socials = JSON.parse(a.guestSocials) as string[];
  if (names.length === 0) return "-";
  return names.map((n, i) => (socials[i] ? `${n} (${socials[i]})` : n)).join(", ");
}

// True when this application offers any action, so the mobile card can skip the
// divider for terminal states (e.g. REJECTED).
function hasActions(a: Application): boolean {
  return (
    a.status === "PENDING" ||
    (a.status === "APPROVED" && a.payToken != null) ||
    (a.status === "PAID" && a.ticketsAccessToken != null)
  );
}

// Status-appropriate action buttons, rendered identically for the desktop table
// and the mobile cards so the two layouts can never drift. The wrapper layout is
// the caller's concern (className): a right-aligned row in the table, a wrapping
// row in the card.
function ApplicationActions({ a, className }: { a: Application; className: string }) {
  return (
    <div className={className}>
      {a.status === "PENDING" && (
        <>
          <form action={approveAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={`${BTN_PRIMARY} bg-sea`}>Onayla</button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={BTN_SECONDARY}>Reddet</button>
          </form>
        </>
      )}
      {a.status === "APPROVED" && a.payToken && (
        <>
          {a.payInPersonRequestedAt && a.ticketsAccessToken == null && (
            <span className="rounded-full bg-moss/10 px-2.5 py-0.5 text-xs font-medium text-moss">
              Şahsen ödeme istedi
            </span>
          )}
          <CopyLink url={`${config.appUrl}/pay/${a.payToken}`} label="Kopyala" />
          <form action={resendLinkAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={BTN_SECONDARY}>Yeniden gönder</button>
          </form>
          <form action={confirmHavaleAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={`${BTN_PRIMARY} bg-hazel`}>Havale&apos;yi onayla</button>
          </form>
          {a.ticketsAccessToken == null ? (
            <form action={giveGatePassAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className={`${BTN_PRIMARY} bg-moss`}>Kapıda öde bileti ver</button>
            </form>
          ) : (
            <>
              <CopyLink
                url={`${config.appUrl}/tickets/${a.ticketsAccessToken}`}
                label="Bilet bağlantısı"
              />
              <form action={revokeGatePassAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className={BTN_SECONDARY}>Bileti iptal et</button>
              </form>
            </>
          )}
        </>
      )}
      {a.status === "PAID" && a.ticketsAccessToken && (
        <>
          <CopyLink
            url={`${config.appUrl}/tickets/${a.ticketsAccessToken}`}
            label="Bilet bağlantısı"
          />
          {a.paymentRef === "havale" && (
            <form action={undoHavaleAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className={BTN_SECONDARY}>Havale&apos;yi geri al</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

// Mobile (sub-md) presentation of one application: the table is hidden and these
// cards take over, so a phone never needs to scroll the wide table sideways.
function ApplicationCard({ a }: { a: Application }) {
  const reference = a.payToken ? havaleReference(a.payToken) : null;
  return (
    <div className="rounded-sm border border-ink/10 bg-mist p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{a.name}</p>
          <p className="mt-0.5 break-all text-sm text-moss">{a.email}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[a.status]}`}
        >
          {STATUS_LABELS[a.status]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-moss">
        Sosyal: {a.socialTags || "-"} &middot; Adet {a.ticketQuantity} &middot;
        Misafir {formatGuests(a)} &middot; Çocuk {a.childCount}
      </p>
      {reference && (
        <p className="mt-1.5 text-sm text-moss">
          Referans: <span className="font-mono text-ink">{reference}</span>
        </p>
      )}
      {hasActions(a) && (
        <ApplicationActions
          a={a}
          className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3"
        />
      )}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session.adminId) redirect("/admin/login");

  const { status } = await searchParams;
  const where =
    status && (STATUSES as readonly string[]).includes(status)
      ? { status: status as (typeof STATUSES)[number] }
      : {};

  const apps = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandLogo size={64} />
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-moss">
              KİNDZİ FEST
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
              Başvurular
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="rounded-sm px-3 py-2 text-sm text-moss transition-colors hover:text-ink"
          >
            Siteyi görüntüle
          </a>
          <a
            href="/admin/door/export"
            className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            Ödeyen katılımcıları indir (CSV)
          </a>
          <a
            href="/admin/m"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90"
          >
            Kapı
          </a>
        </div>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <a
          href="/admin"
          className={`rounded-full px-3 py-1 ${
            !status ? "bg-ink text-cream" : "bg-ink/5 text-moss hover:bg-ink/10"
          }`}
        >
          Tümü
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/admin?status=${s}`}
            className={`rounded-full px-3 py-1 ${
              status === s ? "bg-ink text-cream" : "bg-ink/5 text-moss hover:bg-ink/10"
            }`}
          >
            {STATUS_LABELS[s]}
          </a>
        ))}
      </nav>

      <div className="mt-8 hidden overflow-x-auto rounded-sm border border-ink/10 md:block">
        <table className="w-full text-sm">
          <thead className="bg-cream-deep text-left text-xs uppercase tracking-wider text-moss">
            <tr>
              <th className="px-4 py-3 font-medium">Ad</th>
              <th className="px-4 py-3 font-medium">E-posta</th>
              <th className="px-4 py-3 font-medium">Sosyal</th>
              <th className="px-4 py-3 font-medium">Adet</th>
              <th className="px-4 py-3 font-medium">Misafirler</th>
              <th className="px-4 py-3 font-medium">Çocuk (&lt;12)</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Referans</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-moss">
                  Henüz başvuru yok.
                </td>
              </tr>
            )}
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-ink/10 align-top">
                <td className="px-4 py-3 font-medium text-ink">{a.name}</td>
                <td className="px-4 py-3 text-moss">{a.email}</td>
                <td className="px-4 py-3 text-moss">{a.socialTags}</td>
                <td className="px-4 py-3 text-ink">{a.ticketQuantity}</td>
                <td className="px-4 py-3 text-moss">
                  <span className="block max-w-[14rem] truncate" title={formatGuests(a)}>
                    {formatGuests(a)}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">{a.childCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[a.status]}`}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-ink">
                  {a.payToken ? havaleReference(a.payToken) : "-"}
                </td>
                <td className="px-4 py-3">
                  <ApplicationActions
                    a={a}
                    className="flex flex-wrap items-center justify-end gap-2"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 space-y-3 md:hidden">
        {apps.length === 0 && (
          <p className="rounded-sm border border-ink/10 px-4 py-10 text-center text-moss">
            Henüz başvuru yok.
          </p>
        )}
        {apps.map((a) => (
          <ApplicationCard key={a.id} a={a} />
        ))}
      </div>
    </main>
  );
}
