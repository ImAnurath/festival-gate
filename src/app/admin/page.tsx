import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { approveAction, rejectAction } from "./actions";

const STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  PAID: "Ödendi",
  REJECTED: "Reddedildi",
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
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Başvurular</h1>
        <a href="/admin/door" className="underline">
          Ödeyen katılımcıları indir (CSV)
        </a>
      </div>
      <nav className="mt-4 space-x-3">
        <a href="/admin" className="underline">
          Tümü
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin?status=${s}`} className="underline">
            {STATUS_LABELS[s]}
          </a>
        ))}
      </nav>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Ad</th>
            <th>E-posta</th>
            <th>Sosyal</th>
            <th>Adet</th>
            <th>Misafirler</th>
            <th>Durum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className="border-t">
              <td>{a.name}</td>
              <td>{a.email}</td>
              <td>{a.socialTags}</td>
              <td>{a.ticketQuantity}</td>
              <td>{(JSON.parse(a.guestNames) as string[]).join(", ")}</td>
              <td>{STATUS_LABELS[a.status]}</td>
              <td className="space-x-2 py-1">
                {a.status === "PENDING" && (
                  <>
                    <form action={approveAction} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="bg-green-700 px-2 py-1 text-white">
                        Onayla
                      </button>
                    </form>
                    <form action={rejectAction} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="bg-red-700 px-2 py-1 text-white">
                        Reddet
                      </button>
                    </form>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
