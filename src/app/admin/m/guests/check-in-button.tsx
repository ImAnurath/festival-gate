"use client";

import { useState } from "react";

// Mirrors the scanner's verify/collect contract. Dates arrive as ISO strings
// over JSON (we only branch on `result`, so the string form is fine).
type ScanResult =
  | { result: "valid"; holderName: string; code: string; checkedInAt: string }
  | { result: "used"; holderName: string; code: string; checkedInAt: string }
  | { result: "unpaid"; holderName: string; code: string; quantity: number; amount: number; applicationId: string }
  | { result: "invalid" };

// One ticket's manual check-in. First tap verifies; if the result is `unpaid`
// (a pay-at-door pass), it swaps to a "collect + check in" button that calls the
// same collect endpoint the scanner uses. Any non-200 is treated as invalid.
export default function CheckInButton({ token }: { token: string }) {
  const [state, setState] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(res.ok ? ((await res.json()) as ScanResult) : { result: "invalid" });
    } catch {
      setState({ result: "invalid" });
    } finally {
      setBusy(false);
    }
  }

  if (state?.result === "valid")
    return <span className="text-sm font-medium text-sea">Giriş yapıldı</span>;
  if (state?.result === "used")
    return <span className="text-sm text-amber-600">Zaten okutuldu</span>;
  if (state?.result === "invalid")
    return <span className="text-sm text-red-600">Geçersiz</span>;
  if (state?.result === "unpaid")
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => post("/admin/scan/collect", { token, applicationId: state.applicationId })}
        className="min-h-[40px] rounded-sm bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-opacity active:opacity-80 disabled:opacity-50"
      >
        {state.amount} TL al + giriş
      </button>
    );

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => post("/admin/scan/verify", { token })}
      className="min-h-[40px] rounded-sm bg-sea px-4 py-2 text-sm font-medium text-cream transition-opacity active:opacity-80 disabled:opacity-50"
    >
      Giriş yap
    </button>
  );
}
