import type { Metadata } from "next";
import { EVENT } from "@/lib/event";
import { SELLER, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Hakkımızda — KİNDZİ FEST",
  description:
    "KİNDZİ FEST ve düzenleyen hakkında bilgi: Fatsa, Ordu'da bir günlük Karadeniz şenliği.",
};

export default function HakkimizdaPage() {
  return (
    <>
      <h1>Hakkımızda</h1>

      <p>
        <strong>{EVENT.name}</strong>, {EVENT.city}&apos;da {EVENT.dateLabel}{" "}
        ({EVENT.dayLabel}) günü düzenlenen bir günlük bir Karadeniz şenliğidir.
        Gündüz atölyeler ve panayır, gece DJ&apos;ler ve canlı sahne ile{" "}
        {EVENT.presenter} ev sahipliğinde gerçekleşir.
      </p>

      <p>
        Şenlik {EVENT.tagline.toLowerCase()} Katılım başvuru ile olur:
        misafirler ad, e-posta ve sosyal medya hesaplarını bırakır, başvurular
        tek tek değerlendirilir ve onaylanan misafirlere bilet alım bağlantısı
        e-posta ile gönderilir.
      </p>

      <h2>Düzenleyen ve Satıcı Bilgileri</h2>
      <p>
        Bu site üzerinden yapılan bilet satışları aşağıdaki işletme tarafından
        gerçekleştirilir:
      </p>
      <dl>
        <dt>Ünvan</dt>
        <dd>{SELLER.legalName}</dd>
        <dt>Adres</dt>
        <dd>{SELLER.address}</dd>
        <dt>Vergi Dairesi / No</dt>
        <dd>
          {SELLER.taxOffice} / {SELLER.taxNumber}
        </dd>
        {SELLER.mersisNumber ? (
          <>
            <dt>MERSIS No</dt>
            <dd>{SELLER.mersisNumber}</dd>
          </>
        ) : null}
        <dt>Telefon</dt>
        <dd>{SELLER.phone}</dd>
        <dt>E-posta</dt>
        <dd>
          <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
        </dd>
      </dl>

      <h2>İletişim</h2>
      <p>
        Şenlik, biletler veya başvurularla ilgili her türlü soru için{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a> adresinden ya da{" "}
        <a
          href={EVENT.instagram}
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram
        </a>{" "}
        üzerinden bize ulaşabilirsiniz.
      </p>

      <p className="!mt-10 text-xs text-moss/60">
        Son güncelleme: {LEGAL_UPDATED}
      </p>
    </>
  );
}
