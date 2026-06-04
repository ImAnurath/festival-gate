export type Status = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function approve(status: Status): "APPROVED" {
  if (status !== "PENDING") {
    throw new TransitionError(`Cannot approve from ${status}`);
  }
  return "APPROVED";
}

export function reject(status: Status): "REJECTED" {
  if (status === "PAID") {
    throw new TransitionError("Cannot reject a paid application");
  }
  return "REJECTED";
}

export type PayableApplication = {
  status: Status;
  payTokenExpiresAt: Date | null;
  paidAt: Date | null;
};

export function assertPayable(app: PayableApplication, now: Date): void {
  if (app.status === "PAID" || app.paidAt) {
    throw new TransitionError("Application is already paid");
  }
  if (app.status !== "APPROVED") {
    throw new TransitionError(`Application is not approved (status ${app.status})`);
  }
  if (!app.payTokenExpiresAt || app.payTokenExpiresAt.getTime() <= now.getTime()) {
    throw new TransitionError("Payment link has expired");
  }
}
