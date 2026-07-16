import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const body = await req.json();

  const periodMonth = body.periodMonth as string;
  const [year, month] = periodMonth.split("-").map(Number);

  const payment = await prisma.salaryPayment.create({
    data: {
      workerId: id,
      amount: body.amount ?? worker.monthlySalary,
      periodMonth,
      dueDate: new Date(year, month - 1, 28),
      status: "PENDING",
    },
  });
  return NextResponse.json(payment, { status: 201 });
}
