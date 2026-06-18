import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Scanner from "./scanner";

// Server shell: enforce the admin session (defense-in-depth alongside proxy.ts),
// then render the client camera scanner. The real check-in authorization lives in
// the verify route (requireAdmin); this just keeps the page out of anon hands.
export default async function ScanPage() {
  const session = await getSession();
  if (!session.adminId) redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Kapı tarama</h1>
      <p className="mt-2 text-sm text-moss">
        Bileti kameraya gösterin ya da kodu elle girin.
      </p>
      <Scanner />
    </main>
  );
}
