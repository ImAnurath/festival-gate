"use client";

import { useEffect } from "react";

// Registers the minimal pass-through SW so the admin section is installable.
// Failures are swallowed: registration is best-effort and never blocks the UI.
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
