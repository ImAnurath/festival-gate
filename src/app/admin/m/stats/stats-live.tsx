"use client";

import { useEffect, useState } from "react";
import type { GateStats } from "@/lib/stats";

function Tile({
  label,
  value,
  valueClassName = "text-4xl",
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-mist p-5">
      <p className="text-xs uppercase tracking-wider text-moss">{label}</p>
      <p className={`mt-1 font-display font-semibold text-ink ${valueClassName}`}>{value}</p>
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
        // non-ok response: keep the last good snapshot (no blanking)
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
    <div className="mt-5 space-y-3">
      <div className="rounded-md border border-sea/30 bg-sea/5 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-sea">Girdi</p>
        <p className="mt-1 font-display text-6xl font-semibold leading-none text-ink">
          {stats.checkedIn}
        </p>
        <p className="mt-3 text-sm text-moss">
          Kalan {stats.remaining} · {stats.paidTickets} ödenmiş bilet
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Açık kapı pası" value={stats.outstandingDoorPasses} />
        <Tile
          label="Kapıda tahsilat"
          value={`${stats.doorCollections.count} · ${stats.doorCollections.amount} TL`}
          valueClassName="text-2xl"
        />
      </div>
    </div>
  );
}
