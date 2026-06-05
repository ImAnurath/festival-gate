// Custom Karadeniz line-art ornaments for KİNDZİ FEST.
// Pure presentational SVG (no client JS); inherits `currentColor`.

/**
 * YaylaRidges: layered, fog-separated highland ridgelines with a low hazelnut
 * sun, the misty Karadeniz yayla. The signature hero element for the refined
 * "Yayla" direction: atmospheric, abstract, never clip-art.
 */
export function YaylaRidges({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 200"
      className={className}
      fill="none"
      role="img"
      aria-label="Sisli Karadeniz sıradağları"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* low hazelnut sun, behind the front ridges */}
      <circle cx="566" cy="78" r="13" className="text-hazel sun" fill="currentColor" opacity="0.85" />

      {/* far ridge, dissolved in mist */}
      <path
        d="M0 116 C 120 132, 200 98, 300 114 S 470 88, 600 112 S 740 98, 800 112"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.18"
      />
      {/* middle ridge */}
      <path
        d="M0 134 C 90 152, 165 112, 255 130 S 420 98, 525 126 S 690 102, 800 130"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.34"
      />
      {/* near ridge, the firm horizon */}
      <path
        d="M0 154 C 80 124, 145 136, 215 114 S 335 74, 415 106 S 565 64, 655 100 S 765 124, 800 108"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.58"
      />

      {/* drifting mist over the valley floor */}
      <g className="mist" stroke="currentColor" strokeLinecap="round" opacity="0.22">
        <line x1="150" y1="168" x2="300" y2="168" strokeWidth="1.2" />
        <line x1="360" y1="176" x2="470" y2="176" strokeWidth="1.2" />
        <line x1="520" y1="166" x2="640" y2="166" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

/** A small hazelnut sprig, the mark of Ordu. */
export function Hazelnut({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Fındık"
    >
      {/* nut */}
      <path d="M16 30c5 0 8-3.6 8-8 0-4.4-3.2-7.5-8-7.5S8 17.6 8 22c0 4.4 3 8 8 8Z" />
      {/* husk cap */}
      <path d="M9 16c2.5-2 4.6-2.6 7-2.6S20.5 14 23 16" />
      {/* leaf */}
      <path d="M16 13.4C16 8 19 4 25 3c.6 5.6-2.4 9.6-9 10.4Z" />
      <path d="M19.5 7.6 16 13.4" />
    </svg>
  );
}

/** Hairline divider with a centered hazelnut. */
export function Divider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-ink/30 ${className ?? ""}`}>
      <span className="h-px flex-1 bg-current" />
      <Hazelnut className="h-5 w-5 text-hazel/70" />
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}
