import { gateStats } from "@/lib/stats";
import StatsLive from "./stats-live";

export const dynamic = "force-dynamic";

export default async function MobileStatsPage() {
  const initial = await gateStats();
  return (
    <main className="px-4 py-6">
      <h1 className="font-display text-xl font-semibold text-ink">Sayım</h1>
      <p className="mt-1 text-sm text-moss">Her 10 saniyede güncellenir.</p>
      <StatsLive initial={initial} />
    </main>
  );
}
