import { MOTTO_PICKUP } from "../venue";
import { renderEmail, escapeHtml } from "./email-layout";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string; // inline image content-id (referenced as cid:... in html)
  contentType?: string; // e.g. "image/png"
};
export type EmailMessage = {
  to?: string;
  subject: string;
  text: string; // plain-text fallback (multipart)
  html?: string; // branded HTML body
  attachments?: EmailAttachment[];
};

export interface Notifier {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function buildApprovalEmail(p: { eventName: string; name: string; payUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} başvurunuz onaylandı`,
    text: `Merhaba ${p.name},\n\nGüzel haber, ${p.eventName} için bilet satın almanız onaylandı.\nSatın alma işleminizi buradan tamamlayabilirsiniz (bağlantının süresi yakında dolacaktır):\n${p.payUrl}\n\nEtkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Başvurunuz onaylandı 🎉", color: "#16a34a" },
      heading: `Merhaba ${escapeHtml(p.name)},`,
      bodyHtml: `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} için bilet satın almanız onaylandı. Aşağıdaki butona tıklayarak ödemenizi güvenle tamamlayabilirsiniz.</p>`,
      cta: { label: "Ödemeyi Tamamla →", url: p.payUrl },
      linkBox: {
        label: "🔗 Kişisel ödeme bağlantınız",
        url: p.payUrl,
        caption: "Buton açılmazsa bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın.",
      },
      note: "⏳ Bu bağlantının süresi yakında dolacaktır, lütfen kısa sürede tamamlayın.",
    }),
  };
}

export function buildRejectionEmail(p: { eventName: string; name: string }): EmailMessage {
  return {
    subject: `${p.eventName} başvurunuz hakkında`,
    text: `Merhaba ${p.name},\n\n${p.eventName} etkinliğine gösterdiğiniz ilgi için teşekkür ederiz. Maalesef şu anda size bilet sunamıyoruz.\n\nSaygılarımızla.`,
    html: renderEmail({
      heading: `Merhaba ${escapeHtml(p.name)},`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} etkinliğine gösterdiğiniz ilgi için teşekkür ederiz. Maalesef şu anda size bilet sunamıyoruz.</p>` +
        `<p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#3f3f46;">Saygılarımızla.</p>`,
    }),
  };
}

export function buildConfirmationEmail(p: { eventName: string; name: string; ticketQuantity: number }): EmailMessage {
  return {
    subject: `${p.eventName} biletleriniz onaylandı`,
    text: `Merhaba ${p.name},\n\nÖdemeniz alındı. ${p.eventName} için ${p.ticketQuantity} adet biletiniz bulunuyor.\nGirişte kimliğinizi yanınızda bulundurunuz.\n\nEtkinlikte görüşmek üzere!`,
  };
}

export function buildTicketsEmail(p: { eventName: string; name: string; ticketsUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} biletleriniz hazır`,
    text:
      `Merhaba ${p.name},\n\n` +
      `Ödemeniz alındı. ${p.eventName} biletleriniz bu e-postaya PDF olarak eklenmiştir.\n` +
      `Biletiniz 1 ücretsiz içecek ve 1 ızgara köfte ikramı içerir.\n` +
      `Biletlerinizi çevrimiçi görüntülemek veya yeniden indirmek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutmanız yeterlidir. Etkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Ödemeniz alındı ✅", color: "#16a34a" },
      heading: `İşte biletleriniz, ${escapeHtml(p.name)}! 🎉`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} biletleriniz bu e-postaya <strong>PDF olarak eklenmiştir</strong>. Girişte bu PDF'teki karekodu okutmanız yeterli.</p>` +
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">🍹 Biletiniz <strong>1 ücretsiz içecek</strong> ve <strong>1 ızgara köfte</strong> ikramı içerir.</p>`,
      cta: { label: "Biletlerimi Görüntüle →", url: p.ticketsUrl },
      linkBox: {
        label: "🎫 Bilet bağlantınız",
        url: p.ticketsUrl,
        caption: "Biletlerinizi çevrimiçi görüntülemek veya tekrar indirmek için.",
      },
      note: "Girişte kimliğinizi yanınızda bulundurmayı unutmayın.",
    }),
  };
}

export function buildGatePassEmail(p: { eventName: string; name: string; ticketsUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} QR biletiniz hazır — ödeme girişte`,
    text:
      `Merhaba ${p.name},\n\n` +
      `${p.eventName} için QR biletiniz hazır ve bu e-postaya PDF olarak eklenmiştir.\n` +
      `ÖNEMLİ: Bilet ücretini girişte ödeyeceksiniz; ödemeniz henüz alınmadı.\n` +
      `Dilerseniz fiziksel biletinizi şu adresten de alabilirsiniz: ${MOTTO_PICKUP}\n` +
      `Biletinizi çevrimiçi görüntülemek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutup ödemenizi yapmanız yeterlidir. Etkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Ödeme girişte 🎟️", color: "#D97706" },
      heading: `İşte QR biletiniz, ${escapeHtml(p.name)}!`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} QR biletiniz bu e-postaya <strong>PDF olarak eklenmiştir</strong>.</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCE8;border:1px solid #FDE68A;border-radius:10px;margin:0 0 22px;"><tr><td style="padding:14px 16px;"><p style="margin:0;font-size:14px;line-height:1.55;color:#92400E;"><strong>⚠️ Önemli:</strong> Bilet ücretini <strong>girişte ödeyeceksiniz</strong>; ödemeniz henüz alınmadı. Dilerseniz fiziksel biletinizi ${escapeHtml(MOTTO_PICKUP)} adresinden de alabilirsiniz.</p></td></tr></table>`,
      cta: { label: "Biletimi Görüntüle →", url: p.ticketsUrl },
      linkBox: {
        label: "🎫 Bilet bağlantınız",
        url: p.ticketsUrl,
        caption: "Biletinizi çevrimiçi görüntülemek için.",
      },
      note: "Girişte karekodu okutup ödemenizi yapmanız yeterli.",
    }),
  };
}
