import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("status" in body) {
    data.status = body.status;
    data.paidDate = body.status === "PAID" ? new Date() : null;
  }
  if ("amount" in body) data.amount = Number(body.amount);
  const payment = await prisma.salaryPayment.update({ where: { id }, data });
  return NextResponse.json(payment);
}
