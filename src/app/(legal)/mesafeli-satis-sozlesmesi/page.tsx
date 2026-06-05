import type { Metadata } from "next";
import { config } from "@/lib/config";
import { EVENT } from "@/lib/event";
import { SELLER, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi — KİNDZİ FEST",
  description:
    "KİNDZİ FEST bilet satışına ilişkin mesafeli satış sözleşmesi.",
};

export default function MesafeliSatisPage() {
  return (
    <>
      <h1>Mesafeli Satış Sözleşmesi</h1>

      <h2>1. Taraflar</h2>
      <p>
        <strong>SATICI:</strong> {SELLER.legalName}, {SELLER.address}. Telefon:{" "}
        {SELLER.phone}. E-posta:{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>. Vergi Dairesi /
        No: {SELLER.taxOffice} / {SELLER.taxNumber}.
        {SELLER.mersisNumber ? ` MERSIS No: ${SELLER.mersisNumber}.` : ""}
      </p>
      <p>
        <strong>ALICI:</strong> {EVENT.name} biletini bu site üzerinden satın
        alan kişi (başvuru ve ödeme sırasında bildirdiği ad ve e-posta ile).
      </p>

      <h2>2. Sözleşmenin Konusu</h2>
      <p>
        İşbu sözleşmenin konusu, ALICI&apos;nın SATICI&apos;ya ait{" "}
        {SELLER.website} internet sitesinden elektronik ortamda satın aldığı,
        aşağıda nitelikleri ve satış fiyatı belirtilen etkinlik biletinin
        satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması
        Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince
        tarafların hak ve yükümlülüklerinin belirlenmesidir.
      </p>

      <h2>3. Sözleşme Konusu Ürün/Hizmet</h2>
      <dl>
        <dt>Ürün/Hizmet</dt>
        <dd>
          {EVENT.name} giriş bileti (elektronik bilet). Etkinlik tarihi:{" "}
          {EVENT.dateLabel} ({EVENT.dayLabel}), yeri: {EVENT.city}.
        </dd>
        <dt>Birim Fiyat</dt>
        <dd>Kişi başı {config.ticketPrice} TL (KDV dâhil).</dd>
        <dt>Toplam Tutar</dt>
        <dd>
          Satın alınan bilet adedi ile birim fiyatın çarpımı kadar olup, ödeme
          sayfasında ALICI&apos;ya açıkça gösterilir.
        </dd>
        <dt>Ödeme Şekli</dt>
        <dd>
          Kredi/banka kartı ile, iyzico güvenli ödeme altyapısı üzerinden tek
          seferde tahsil edilir.
        </dd>
      </dl>

      <h2>4. Genel Hükümler</h2>
      <ul>
        <li>
          ALICI, sözleşme konusu biletin temel nitelikleri, satış fiyatı ve
          ödeme şekli ile teslimata ilişkin tüm bilgileri okuyup bilgi sahibi
          olduğunu ve elektronik ortamda gerekli teyidi verdiğini kabul eder.
        </li>
        <li>
          Bilet, ALICI&apos;nın başvurusunun SATICI tarafından onaylanması ve
          ödemenin başarıyla tamamlanması üzerine geçerli olur.
        </li>
        <li>
          ALICI, etkinlik girişinde geçerli bir kimlik belgesi ve ödeme onayını
          ibraz etmekle yükümlüdür.
        </li>
      </ul>

      <h2>5. Teslimat</h2>
      <p>
        Bilet elektronik bir hizmet olup fiziki teslimat ve kargo söz konusu
        değildir. Ödemenin onaylanmasının ardından, satın alma onayı
        ALICI&apos;nın başvuru sırasında bildirdiği e-posta adresine
        gönderilir. Etkinlik girişi bu onay ve kimlik ibrazı ile sağlanır.
      </p>

      <h2>6. Cayma Hakkı</h2>
      <p>
        Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesi uyarınca, belirli
        bir tarihte yapılması gereken eğlence ve dinlenme amaçlı etkinliklere
        ilişkin hizmetlerde tüketicinin cayma hakkı bulunmamaktadır. {EVENT.name}{" "}
        bileti belirli bir tarihte ({EVENT.dateLabel}) gerçekleşecek bir etkinlik
        için satıldığından, bu kapsamda cayma hakkı kullanılamaz.
      </p>

      <h2>7. İade ve İptal</h2>
      <p>
        Satın alınan biletler iade edilmez ve para iadesi yapılmaz. Bunun tek
        istisnası, etkinliğin SATICI tarafından iptal edilmesi veya
        ertelenmesidir; bu hâlde ALICI&apos;nın ödediği bedel, ödemenin
        yapıldığı yönteme aynı tutarda iade edilir. Ayrıntılar için{" "}
        <a href="/teslimat-iade">Teslimat ve İade Şartları</a> sayfasına bakınız.
      </p>

      <h2>8. Uyuşmazlıkların Çözümü</h2>
      <p>
        İşbu sözleşmeden doğabilecek uyuşmazlıklarda, Ticaret Bakanlığı&apos;nca
        ilan edilen parasal sınırlar dâhilinde ALICI&apos;nın yerleşim yerindeki
        Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.
      </p>

      <h2>9. Yürürlük</h2>
      <p>
        ALICI, ödeme işlemini tamamlayarak işbu sözleşmenin tüm koşullarını
        okuduğunu, anladığını ve kabul ettiğini beyan eder. Sözleşme, ödemenin
        tamamlandığı anda yürürlüğe girer.
      </p>

      <p className="!mt-10 text-xs text-moss/60">
        Son güncelleme: {LEGAL_UPDATED}
      </p>
    </>
  );
}
