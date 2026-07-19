// KİNDZİ FEST — event details shown on the public pages.
// The canonical event name for emails/payment comes from config.eventName
// (set EVENT_NAME in .env); keep this name in sync with it.

export const EVENT = {
  name: "KİNDZİ FEST",
  presenter: "Deniz'in Yeri Dua Yeri",
  dateLabel: "26 Temmuz 2026",
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
    {
      type: "video",
      src: "/venue/fest-program.mp4",
      poster: "/venue/fest-program-poster.jpg",
      alt: "KİNDZİ FEST program videosu: atölyeler, Umutcan Genç, Soner Arıca, Kafkas Ekibi ve Ezgi Hocaoğlu",
    },
    {
      type: "video",
      src: "/venue/top-middle.mp4",
      poster: "/venue/top-middle-poster.jpg",
      alt: "Deniz'in Yeri Dua Yeri'nin atmosferi",
    },
    {
      type: "video",
      src: "/venue/ezgi-hocaoglu.mp4",
      poster: "/venue/ezgi-hocaoglu-poster.jpg",
      alt: "Ezgi Hocaoğlu DJ performans tanıtım videosu",
    },
    {
      type: "video",
      src: "/venue/umutcan-genc.mp4",
      poster: "/venue/umutcan-genc-poster.jpg",
      alt: "Umutcan Genç DJ performans tanıtım videosu",
    },
  ],
} as const;
