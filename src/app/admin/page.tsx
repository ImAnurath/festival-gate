import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getSession } from "@/lib/session";
import { approveAction, rejectAction, resendLinkAction } from "./actions";
import CopyLink from "@/components/copy-link";
import BrandLogo from "@/components/brand-logo";

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
            href="/admin/scan"
            className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            Kapı tarama
          </a>
          <a
            href="/admin/door"
            className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            Kapı tahsilatı
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

      <div className="mt-8 overflow-x-auto rounded-sm border border-ink/10">
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
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-moss">
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
                  {(() => {
                    const names = JSON.parse(a.guestNames) as string[];
                    const socials = JSON.parse(a.guestSocials) as string[];
                    if (names.length === 0) return "-";
                    return names
                      .map((n, i) => (socials[i] ? `${n} (${socials[i]})` : n))
                      .join(", ");
                  })()}
                </td>
                <td className="px-4 py-3 text-ink">{a.childCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[a.status]}`}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {a.status === "PENDING" && (
                    <div className="flex gap-2">
                      <form action={approveAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-sm bg-sea px-3 py-1.5 text-xs font-medium text-cream transition-opacity hover:opacity-90">
                          Onayla
                        </button>
                      </form>
                      <form action={rejectAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5">
                          Reddet
                        </button>
                      </form>
                    </div>
                  )}
                  {a.status === "APPROVED" && a.payToken && (
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyLink url={`${config.appUrl}/pay/${a.payToken}`} />
                      <form action={resendLinkAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5">
                          Yeniden gönder
                        </button>
                      </form>
                    </div>
                  )}
                  {a.status === "PAID" && a.ticketsAccessToken && (
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyLink
                        url={`${config.appUrl}/tickets/${a.ticketsAccessToken}`}
                        label="Bilet bağlantısını kopyala"
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
