import { Prisma, type PrismaClient, type Application, type Ticket } from "@prisma/client";
import { generatePayToken, generateVerifyToken, generateTicketCode } from "./token";
import { prisma } from "./prisma";
import { config } from "./config";

// Accept either the root client or a transaction handle, so issuance can run
// inside the payment transaction or standalone (seed/backfill).
type Db = PrismaClient | Prisma.TransactionClient;

export type Attendee = { holderName: string; isBuyer: boolean };

// Buyer first, then each named guest. Children (childCount) are free and not ticketed.
export function attendeesFor(
  application: Pick<Application, "name" | "guestNames">
): Attendee[] {
  const guests = JSON.parse(application.guestNames) as string[];
  return [
    { holderName: application.name, isBuyer: true },
    ...guests.map((holderName) => ({ holderName, isBuyer: false })),
  ];
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function createTicketWithUniqueCode(
  db: Db,
  applicationId: string,
  attendee: Attendee
): Promise<Ticket> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await db.ticket.create({
        data: {
          applicationId,
          holderName: attendee.holderName,
          isBuyer: attendee.isBuyer,
          code: generateTicketCode(),
          verifyToken: generateVerifyToken(),
        },
      });
    } catch (err) {
      // Retry only on a code/token collision; otherwise surface the error.
      if (isUniqueViolation(err) && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique ticket code after retries");
}

/**
 * Creates one ticket per attendee for a paid application and stamps the
 * application's ticketsAccessToken. Idempotent: if the token is already set,
 * returns the existing tickets and creates nothing.
 */
export async function issueTickets(db: Db, application: Application): Promise<Ticket[]> {
  if (application.ticketsAccessToken) {
    return db.ticket.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: "asc" },
    });
  }

  const attendees = attendeesFor(application);
  const created: Ticket[] = [];
  for (const attendee of attendees) {
    created.push(await createTicketWithUniqueCode(db, application.id, attendee));
  }

  await db.application.update({
    where: { id: application.id },
    data: { ticketsAccessToken: generatePayToken() },
  });

  return created;
}

export type TicketsView =
  | { kind: "valid"; application: Application; tickets: Ticket[] }
  | { kind: "expired" }
  | { kind: "notfound" };

/**
 * Loads a paid application's tickets by its public ticketsAccessToken for the
 * retrieval page / PDF route. `now` and `eventEnd` are injectable for testing;
 * they default to the real clock and the configured event-end cutoff.
 * After `eventEnd`, the link is considered expired regardless of token validity.
 */
export async function loadTicketsByAccessToken(
  token: string,
  now: Date = new Date(),
  eventEnd: Date = config.eventEnd,
): Promise<TicketsView> {
  const application = await prisma.application.findUnique({
    where: { ticketsAccessToken: token },
    include: { tickets: { orderBy: { createdAt: "asc" } } },
  });
  if (!application) return { kind: "notfound" };
  if (now >= eventEnd) return { kind: "expired" };
  return { kind: "valid", application, tickets: application.tickets };
}

export type CheckInResult =
  | { result: "valid"; holderName: string; code: string; checkedInAt: Date }
  | { result: "used"; holderName: string; code: string; checkedInAt: Date }
  | { result: "invalid" };

/**
 * Checks a ticket in by its verifyToken OR its human code, single-use.
 * The guarded updateMany (status VALID -> USED) is the single-use boundary:
 * under concurrency exactly one caller flips the row (count === 1); any other
 * caller sees count === 0 and reports the existing USED state with its original
 * checkedInAt. `now` is injectable for tests.
 */
export async function checkInTicket(
  identifier: string,
  now: Date = new Date(),
): Promise<CheckInResult> {
  const match = { OR: [{ verifyToken: identifier }, { code: identifier }] };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { ...match, status: "VALID" },
      data: { status: "USED", checkedInAt: now },
    });
    if (updated.count === 1) {
      const t = await tx.ticket.findFirstOrThrow({ where: match });
      return { result: "valid", holderName: t.holderName, code: t.code, checkedInAt: t.checkedInAt! };
    }
    const existing = await tx.ticket.findFirst({ where: match });
    if (existing && existing.status === "USED") {
      return { result: "used", holderName: existing.holderName, code: existing.code, checkedInAt: existing.checkedInAt! };
    }
    return { result: "invalid" };
  });
}
