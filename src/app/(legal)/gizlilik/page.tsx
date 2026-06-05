import type { Metadata } from "next";
import { EVENT } from "@/lib/event";
import { SELLER, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Gizlilik Sözleşmesi — KİNDZİ FEST",
  description:
    "KİNDZİ FEST gizlilik ve kişisel verilerin korunması (KVKK) politikası.",
};

export default function GizlilikPage() {
  return (
    <>
      <h1>Gizlilik Sözleşmesi ve KVKK Aydınlatma Metni</h1>

      <p>
        {SELLER.legalName} (&quot;{EVENT.name}&quot;, &quot;biz&quot;) olarak
        kişisel verilerinizin gizliliğine önem veriyoruz. Bu metin, 6698 sayılı
        Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri
        sorumlusu sıfatıyla kişisel verilerinizi nasıl topladığımızı,
        kullandığımızı ve koruduğumuzu açıklar.
      </p>

      <h2>Veri Sorumlusu</h2>
      <p>
        {SELLER.legalName}, {SELLER.address}. İletişim:{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>, {SELLER.phone}.
      </p>

      <h2>Topladığımız Veriler</h2>
      <ul>
        <li>
          <strong>Başvuru bilgileri:</strong> ad soyad, e-posta adresi ve
          herkese açık sosyal medya hesabınız.
        </li>
        <li>
          <strong>Bilet bilgileri:</strong> talep ettiğiniz bilet adedi ve
          ödeme durumu.
        </li>
        <li>
          <strong>Ödeme verileri:</strong> ödemeler ödeme kuruluşu iyzico
          altyapısı üzerinden alınır. Kart bilgileriniz tarafımızca görülmez ve
          saklanmaz; doğrudan iyzico&apos;nun güvenli ortamında işlenir.
        </li>
      </ul>

      <h2>Verilerin İşlenme Amacı</h2>
      <ul>
        <li>Başvurunuzun değerlendirilmesi ve etkinliğe katılımın yönetimi.</li>
        <li>Bilet satışı, ödeme alımı ve etkinlik girişinin sağlanması.</li>
        <li>
          Başvuru ve biletinizle ilgili e-posta yoluyla sizinle iletişim
          kurulması.
        </li>
        <li>Yasal yükümlülüklerin yerine getirilmesi.</li>
      </ul>

      <h2>Verilerin Paylaşımı</h2>
      <p>
        Kişisel verileriniz, yalnızca hizmetin sağlanması için gerekli olduğu
        ölçüde aşağıdaki taraflarla paylaşılır:
      </p>
      <ul>
        <li>
          <strong>iyzico</strong> (iyzico Ödeme ve Elektronik Para Hizmetleri
          A.Ş.) — ödemenin güvenli şekilde alınması için.
        </li>
        <li>
          <strong>E-posta gönderim sağlayıcısı</strong> — onay ve bilgilendirme
          e-postalarının iletilmesi için.
        </li>
        <li>Yasal olarak zorunlu hâllerde yetkili kamu kurum ve kuruluşları.</li>
      </ul>
      <p>Verileriniz pazarlama amacıyla üçüncü kişilere satılmaz.</p>

      <h2>Saklama Süresi</h2>
      <p>
        Başvuru bilgileriniz yalnızca etkinlik girişinin sağlanması amacıyla
        saklanır ve etkinlik sonrasında, yasal saklama yükümlülükleri saklı
        kalmak kaydıyla silinir. Ödeme ve fatura kayıtları ilgili mevzuatın
        öngördüğü süre boyunca tutulur.
      </p>

      <h2>KVKK Kapsamındaki Haklarınız</h2>
      <p>KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme.</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme.</li>
        <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.</li>
        <li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme.</li>
        <li>Verilerinizin silinmesini veya yok edilmesini isteme.</li>
        <li>İşlemenin hukuka aykırı olması hâlinde itiraz etme.</li>
      </ul>
      <p>
        Bu haklarınızı kullanmak için{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a> adresine
        başvurabilirsiniz.
      </p>

      <h2>Çerezler</h2>
      <p>
        Sitemiz, yalnızca sitenin çalışması ve oturum güvenliği için gerekli
        teknik çerezleri kullanır. Pazarlama veya üçüncü taraf takip çerezi
        kullanılmaz.
      </p>

      <p className="!mt-10 text-xs text-moss/60">
        Son güncelleme: {LEGAL_UPDATED}
      </p>
    </>
  );
}
