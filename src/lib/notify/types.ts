export type EmailMessage = { to?: string; subject: string; text: string };

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
