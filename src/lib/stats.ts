import { prisma } from "./prisma";

export type GateStats = {
  checkedIn: number;
  paidTickets: number;
  remaining: number;
  outstandingDoorPasses: number;
  doorCollections: { count: number; amount: number };
};

// Live gate counts. Derived carefully around the pay-at-door invariant: tickets
// can exist for an unpaid (APPROVED) application, so "paid tickets" filters on
// the application status, and outstanding door passes are their own number.
export async function gateStats(): Promise<GateStats> {
  const [checkedIn, paidTickets, outstandingDoorPasses, door] = await Promise.all([
    prisma.ticket.count({ where: { status: "USED" } }),
    prisma.ticket.count({ where: { application: { status: "PAID" } } }),
    prisma.ticket.count({
      where: { application: { status: "APPROVED", ticketsAccessToken: { not: null } } },
    }),
    prisma.application.aggregate({
      where: { paymentRef: "door-pos" },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return {
    checkedIn,
    paidTickets,
    remaining: Math.max(0, paidTickets - checkedIn),
    outstandingDoorPasses,
    doorCollections: { count: door._count, amount: door._sum.amount ?? 0 },
  };
}
