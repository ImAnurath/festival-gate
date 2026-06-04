import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await fetch(`${config.appUrl}/api/payment/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payToken: token, ref: "stub_confirm" }),
  });
  return NextResponse.redirect(`${config.appUrl}/pay/${token}`);
}
