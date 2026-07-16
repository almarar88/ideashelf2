import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET() {
  const farm = await getDefaultFarm();
  const expenses = await prisma.expense.findMany({
    where: { farmId: farm.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const farm = await getDefaultFarm();
  const body = await req.json();
  if (!body.category || !body.amount || !body.date) {
    return NextResponse.json({ error: "الفئة والمبلغ والتاريخ مطلوبة" }, { status: 400 });
  }
  const expense = await prisma.expense.create({
    data: {
      farmId: farm.id,
      category: body.category,
      amount: Number(body.amount),
      date: new Date(body.date),
      description: body.description ?? null,
    },
  });

  await prisma.calendarEvent.create({
    data: {
      farmId: farm.id,
      title: `مصروف: ${body.description || body.category}`,
      date: new Date(body.date),
      type: "EXPENSE",
      relatedType: "Expense",
      relatedId: expense.id,
      completed: true,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
