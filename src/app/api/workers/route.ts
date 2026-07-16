import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET() {
  const farm = await getDefaultFarm();
  const workers = await prisma.worker.findMany({
    where: { farmId: farm.id },
    orderBy: { createdAt: "asc" },
    include: { salaryPayments: { orderBy: { dueDate: "desc" }, take: 3 } },
  });
  return NextResponse.json(workers);
}

export async function POST(req: NextRequest) {
  const farm = await getDefaultFarm();
  const body = await req.json();
  if (!body.name || !body.monthlySalary) {
    return NextResponse.json({ error: "الاسم والراتب الشهري مطلوبان" }, { status: 400 });
  }
  const worker = await prisma.worker.create({
    data: {
      farmId: farm.id,
      name: body.name,
      phone: body.phone ?? null,
      position: body.position ?? null,
      monthlySalary: Number(body.monthlySalary),
      hireDate: body.hireDate ? new Date(body.hireDate) : null,
      status: body.status ?? "ACTIVE",
      notes: body.notes ?? null,
    },
  });

  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await prisma.salaryPayment.create({
    data: {
      workerId: worker.id,
      amount: worker.monthlySalary,
      periodMonth,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 28),
      status: "PENDING",
    },
  });

  return NextResponse.json(worker, { status: 201 });
}
