// Seller / merchant legal identity shown on the legally required pages
// (Hakkımızda, Mesafeli Satış Sözleşmesi, Gizlilik Sözleşmesi, Teslimat & İade).
//
// IMPORTANT: These details MUST match the business registered with iyzico.
// If they don't, iyzico will reject the site during its document review.
// Replace every "DOLDURULACAK" value with the real registered business info
// before submitting the site to iyzico, then redeploy.

export const SELLER = {
  /** Yasal ünvan, e.g. "Örnek Organizasyon Ltd. Şti." or "Ad Soyad" (şahıs) */
  legalName: "Meliha Danışır",
  /** Public-facing trade name shown to buyers */
  tradeName: "KİNDZİ FEST",
  /** Tam kayıtlı adres (cadde, no, ilçe, il, posta kodu) */
  address:
    "Duayeri Mah. Gençoğlu Sk. Cemal, No: 14/1, Fatsa / Ordu",
  /** Vergi dairesi */
  taxOffice: "Fatsa Vergi Dairesi",
  /** Vergi No (şirket) veya T.C. Kimlik No (şahıs) */
  taxNumber: "2700137776",
  /** MERSIS No (yalnızca tüzel kişi/şirket için; şahıs şirketinde boş bırakın) */
  mersisNumber: "",
  /** İletişim telefonu */
  phone: "+90 535 716 33 99",
  /** Müşteri/destek e-postası */
  email: "danisir@gmail.com",
  /** Sitenin canlı adresi, e.g. "https://kindzifest.com" */
  website: "https://festival-gate.vercel.app",
} as const;

/** Shown as "Son güncelleme" on each legal page. Update when text changes. */
export const LEGAL_UPDATED = "5 Haziran 2026";
