"use client";

import { useState } from "react";

/** Small button that copies a payment link to the clipboard (admin use). */
export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers / insecure contexts
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/5"
    >
      {copied ? "Kopyalandı ✓" : "Bağlantıyı kopyala"}
    </button>
  );
}
