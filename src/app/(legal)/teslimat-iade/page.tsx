import type { Metadata } from "next";
import { EVENT } from "@/lib/event";
import { SELLER, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Teslimat ve İade Şartları — KİNDZİ FEST",
  description:
    "KİNDZİ FEST bilet teslimatı ve iade/iptal koşulları.",
};

export default function TeslimatIadePage() {
  return (
    <>
      <h1>Teslimat ve İade Şartları</h1>

      <h2>Teslimat</h2>
      <p>
        {EVENT.name} bileti elektronik bir hizmettir; fiziki teslimat, kargo
        veya teslimat ücreti söz konusu değildir.
      </p>
      <ul>
        <li>
          Başvurunuz onaylandıktan sonra, e-posta ile gönderilen bağlantı
          üzerinden ödemenizi yaparsınız.
        </li>
        <li>
          Ödemeniz onaylandığında, satın alma onayı başvuru sırasında
          bildirdiğiniz e-posta adresine anında gönderilir.
        </li>
        <li>
          Etkinlik girişi, bu onay ve geçerli bir kimlik belgesinin ibrazı ile
          {EVENT.dateLabel} ({EVENT.dayLabel}) tarihinde {EVENT.city}&apos;da
          sağlanır.
        </li>
      </ul>

      <h2>İade ve İptal</h2>
      <p>
        Satın alınan biletler <strong>iade edilmez</strong> ve bilet bedeli için
        para iadesi yapılmaz. Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15.
        maddesi gereğince, belirli bir tarihte gerçekleşecek eğlence
        etkinliklerine ilişkin biletlerde cayma hakkı bulunmadığından,
        biletinizi satın aldıktan sonra iptal ederek ücret iadesi talep
        edemezsiniz.
      </p>

      <h2>Etkinliğin İptali veya Ertelenmesi</h2>
      <p>
        İade yapılmamasının tek istisnası, etkinliğin düzenleyen tarafından
        iptal edilmesi veya ertelenmesidir. Böyle bir durumda:
      </p>
      <ul>
        <li>
          Etkinlik iptal edilirse, ödediğiniz bedelin tamamı, ödemeyi yaptığınız
          karta/yönteme iade edilir.
        </li>
        <li>
          Etkinlik ertelenirse, biletiniz yeni tarihte geçerli olur; yeni tarihe
          katılamayacaksanız bedelin tamamının iadesini talep edebilirsiniz.
        </li>
        <li>
          İade işlemleri, ilgili durumun duyurulmasından itibaren makul süre
          içinde gerçekleştirilir.
        </li>
      </ul>

      <h2>İletişim</h2>
      <p>
        İptal/erteleme kaynaklı iade talepleriniz ve diğer sorularınız için{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a> ({SELLER.phone})
        adresinden bize ulaşabilirsiniz.
      </p>

      <p className="!mt-10 text-xs text-moss/60">
        Son güncelleme: {LEGAL_UPDATED}
      </p>
    </>
  );
}
