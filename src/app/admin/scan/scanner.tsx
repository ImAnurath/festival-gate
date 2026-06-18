"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type CheckInResult =
  | { result: "valid"; holderName: string; code: string; checkedInAt: string }
  | { result: "used"; holderName: string; code: string; checkedInAt: string }
  | { result: "invalid" };

const READER_ID = "kf-scan-reader";
const RESULT_MS = 2500;

export default function Scanner() {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function verify(token: string) {
    setError(null);
    try {
      const res = await fetch("/admin/scan/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("Yetki hatası veya bağlantı sorunu. Tekrar deneyin.");
        return;
      }
      setResult((await res.json()) as CheckInResult);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setResult(null);
    busyRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      // resume throws only if not paused; safe to ignore.
    }
  }

  async function handleDecode(token: string) {
    if (busyRef.current) return; // debounce: ignore repeat frames of the same scan
    busyRef.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {
      // pause throws only if not scanning; safe to ignore.
    }
    await verify(token);
    timerRef.current = setTimeout(dismiss, RESULT_MS);
  }

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          void handleDecode(decoded);
        },
        () => {
          // per-frame decode failure; ignore.
        },
      )
      .catch(() => {
        setCameraError(
          "Kamera açılamadı. Kamera izni verildiğinden ve güvenli bağlantı kullanıldığından emin olun. Aşağıdan kod ile giriş yapabilirsiniz.",
        );
        setManualOpen(true);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          // already stopped / never started; ignore.
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manualValue.trim();
    if (!v) return;
    setManualValue("");
    void verify(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setResult(null), RESULT_MS);
  }

  const bg =
    result?.result === "valid"
      ? "bg-green-600"
      : result?.result === "used"
        ? "bg-amber-500"
        : "bg-red-600";

  return (
    <div className="mt-6">
      <div id={READER_ID} className="overflow-hidden rounded-sm border border-ink/10" />

      {cameraError && <p className="mt-3 text-sm text-red-600">{cameraError}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => setManualOpen((o) => !o)}
        className="mt-4 text-sm text-sea underline"
      >
        {manualOpen ? "Kod girişini kapat" : "Kod gir (KF-...)"}
      </button>

      {manualOpen && (
        <form onSubmit={onManualSubmit} className="mt-3 flex gap-2">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="KF-XXXXX"
            autoCapitalize="characters"
            className="flex-1 rounded-sm border border-ink/20 px-3 py-2 text-sm"
          />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm text-cream">
            Onayla
          </button>
        </form>
      )}

      {result && (
        <button
          type="button"
          onClick={dismiss}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${bg}`}
        >
          <span className="text-7xl leading-none">
            {result.result === "valid" ? "✓" : result.result === "used" ? "!" : "✕"}
          </span>
          <span className="mt-4 text-2xl font-semibold uppercase tracking-wide">
            {result.result === "valid"
              ? "Geçerli"
              : result.result === "used"
                ? "Zaten okutuldu"
                : "Geçersiz"}
          </span>
          {result.result !== "invalid" && (
            <>
              <span className="mt-6 text-3xl font-bold">{result.holderName}</span>
              <span className="mt-1 text-lg opacity-90">{result.code}</span>
            </>
          )}
          {result.result === "used" && (
            <span className="mt-4 text-sm opacity-80">
              Giriş zamanı:{" "}
              {new Date(result.checkedInAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span className="mt-10 text-xs uppercase tracking-widest opacity-70">
            Devam etmek için dokun
          </span>
        </button>
      )}
    </div>
  );
}
