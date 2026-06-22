"use client";

import { useEffect, useState } from "react";
import type { GateStats } from "@/lib/stats";

function Card({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-sm border p-4 ${accent ? "border-sea/30 bg-sea/5" : "border-ink/10 bg-mist"}`}>
      <p className="text-xs uppercase tracking-wider text-moss">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold text-ink">{value}</p>
    </div>
  );
}

// Polls the stats endpoint every 10s. On a failed fetch it keeps the last good
// numbers (no blanking). Seeded with the server snapshot so the first paint has data.
export default function StatsLive({ initial }: { initial: GateStats }) {
  const [stats, setStats] = useState<GateStats>(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/admin/m/api/stats", { cache: "no-store" });
        if (res.ok && alive) setStats((await res.json()) as GateStats);
      } catch {
        // keep the last good snapshot
      }
    };
    const id = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Card label="Girdi" value={stats.checkedIn} accent />
      <Card label="Kalan" value={stats.remaining} />
      <Card label="Ödenmiş bilet" value={stats.paidTickets} />
      <Card label="Açık kapı pası" value={stats.outstandingDoorPasses} />
      <div className="col-span-2">
        <Card
          label="Kapıda tahsilat"
          value={`${stats.doorCollections.count} · ${stats.doorCollections.amount} TL`}
        />
      </div>
    </div>
  );
}
