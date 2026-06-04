export type EmailMessage = { to?: string; subject: string; text: string };

export interface Notifier {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function buildApprovalEmail(p: { eventName: string; name: string; payUrl: string }): EmailMessage {
  return {
    subject: `You're approved for ${p.eventName}`,
    text: `Hi ${p.name},\n\nGood news, you're approved to buy tickets for ${p.eventName}.\nComplete your purchase here (link expires soon):\n${p.payUrl}\n\nSee you there!`,
  };
}

export function buildRejectionEmail(p: { eventName: string; name: string }): EmailMessage {
  return {
    subject: `Update on your ${p.eventName} application`,
    text: `Hi ${p.name},\n\nThank you for your interest in ${p.eventName}. Unfortunately we are not able to offer you tickets at this time.\n\nKind regards.`,
  };
}

export function buildConfirmationEmail(p: { eventName: string; name: string; ticketQuantity: number }): EmailMessage {
  return {
    subject: `Your ${p.eventName} tickets are confirmed`,
    text: `Hi ${p.name},\n\nYour payment is confirmed. You have ${p.ticketQuantity} ticket(s) for ${p.eventName}.\nBring your ID to the entrance.\n\nSee you there!`,
  };
}
