import { NextResponse } from "next/server";
import { Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await getSession();
  if (!session.adminId) return new NextResponse("Yetkisiz", { status: 401 });

  const paid = await prisma.application.findMany({
    where: { status: Status.PAID },
    orderBy: { name: "asc" },
  });

  const csv = toCsv(
    ["Alıcı", "E-posta", "Bilet", "Misafirler"],
    paid.map((a) => [
      a.name,
      a.email,
      String(a.ticketQuantity),
      (JSON.parse(a.guestNames) as string[]).join("; "),
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="kapi-listesi.csv"',
    },
  });
}
