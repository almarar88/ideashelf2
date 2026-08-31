import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = await prisma.worker.findUnique({
    where: { id },
    include: { salaryPayments: { orderBy: { dueDate: "desc" } } },
  });
  if (!worker) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(worker);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["name", "phone", "position", "status", "notes"]) {
    if (key in body) data[key] = body[key];
  }
  if ("monthlySalary" in body) data.monthlySalary = Number(body.monthlySalary);
  if ("hireDate" in body) data.hireDate = body.hireDate ? new Date(body.hireDate) : null;
  const worker = await prisma.worker.update({ where: { id }, data });
  return NextResponse.json(worker);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.worker.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
