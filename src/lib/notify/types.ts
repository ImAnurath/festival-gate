import { MOTTO_PICKUP } from "../venue";

export type EmailAttachment = { filename: string; content: Buffer };
export type EmailMessage = {
  to?: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
};

export interface Notifier {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function buildApprovalEmail(p: { eventName: string; name: string; payUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} başvurunuz onaylandı`,
    text: `Merhaba ${p.name},\n\nGüzel haber, ${p.eventName} için bilet satın almanız onaylandı.\nSatın alma işleminizi buradan tamamlayabilirsiniz (bağlantının süresi yakında dolacaktır):\n${p.payUrl}\n\nEtkinlikte görüşmek üzere!`,
  };
}

export function buildRejectionEmail(p: { eventName: string; name: string }): EmailMessage {
  return {
    subject: `${p.eventName} başvurunuz hakkında`,
    text: `Merhaba ${p.name},\n\n${p.eventName} etkinliğine gösterdiğiniz ilgi için teşekkür ederiz. Maalesef şu anda size bilet sunamıyoruz.\n\nSaygılarımızla.`,
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
  };
}
