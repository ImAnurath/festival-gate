import { NextResponse } from "next/server";
import { Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session.adminId) return new NextResponse("Unauthorized", { status: 401 });

  const paid = await prisma.application.findMany({
    where: { status: Status.PAID },
    orderBy: { name: "asc" },
  });

  const header = ["Buyer", "Email", "Tickets", "Guests"].join(",");
  const rows = paid.map((a) =>
    [
      csvCell(a.name),
      csvCell(a.email),
      String(a.ticketQuantity),
      csvCell((JSON.parse(a.guestNames) as string[]).join("; ")),
    ].join(",")
  );
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="door-list.csv"',
    },
  });
}
