import { Prisma, type PrismaClient, type Application, type Ticket } from "@prisma/client";
import { generatePayToken, generateVerifyToken, generateTicketCode } from "./token";

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
