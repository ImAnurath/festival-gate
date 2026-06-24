// KİNDZİ FEST — event details shown on the public pages.
// The canonical event name for emails/payment comes from config.eventName
// (set EVENT_NAME in .env); keep this name in sync with it.

export const EVENT = {
  name: "KİNDZİ FEST",
  presenter: "Deniz'in Yeri Dua Yeri",
  dateLabel: "12 Temmuz 2026",
  dayLabel: "Pazar",
  city: "Fatsa, Ordu",
  tagline:
    "Karadeniz'in yeşili, Fatsa'nın denizi. Bir günde tek şenlik: gündüz atölyeler ve panayır, gece DJ'ler ve canlı sahne.",
  program: [
    {
      key: "gunduz",
      kicker: "Gündüz",
      time: "09:00 – 18:00",
      title: "Atölyeler & Panayır",
      desc: "El emeği tezgâhlar, yöresel lezzetler ve gün boyu atölyeler.",
    },
    {
      key: "gece",
      kicker: "Gece",
      time: "18:00 – 01:00",
      title: "DJ'ler & Soner Arıca",
      desc: "DJ setleriyle başlayan gece, Soner Arıca canlı sahnesiyle sürüyor.",
    },
  ],
  instagram: "https://www.instagram.com/denizinyeriduayeri/",
  // Venue's own photos (from @denizinyeriduayeri). Replace or add by dropping
  // files into /public/venue and editing this list.
  gallery: [
    { src: "/venue/karadeniz.jpg", alt: "Fatsa, Ordu: sisli Karadeniz manzarası" },
    { src: "/venue/kindzi-fest-program.jpg", alt: "KİNDZİ FEST sahne programı: Umutcan Genç, Soner Arıca, Kafkas ekibi ve Ezgi Hocaoğlu" },
    { src: "/venue/tesis-kus-bakisi.jpg", alt: "Deniz'in Yeri Dua Yeri'nin kuş bakışı görünümü" },
    { src: "/venue/bahce-manzara.jpg", alt: "Deniz'in Yeri'nin deniz manzaralı bahçesi ve kameriyesi" },
    { src: "/venue/sisli-bahce.jpg", alt: "Bulutlu havada Deniz'in Yeri'nin yeşil bahçesi ve oturma alanı" },
    { src: "/venue/ic-mekan.jpg", alt: "Deniz'in Yeri'nin şömineli, ahşap tavanlı iç mekânı" },
  ],
} as const;
