import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Display: Fraunces, a high-contrast expressive serif (Turkish glyphs via latin-ext).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

// Body/UI: Hanken Grotesk, clean and warm, full Turkish support.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KİNDZİ FEST · Fatsa, Ordu",
  description:
    "KİNDZİ FEST: Fatsa'da bir günlük Karadeniz şenliği. Gündüz atölyeler ve panayır, gece DJ'ler ve Soner Arıca. Katılım başvuru ile.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${fraunces.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
