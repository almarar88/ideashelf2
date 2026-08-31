import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET(req: NextRequest) {
  const farm = await getDefaultFarm();
  const { searchParams } = new URL(req.url);
  const from = new Date(searchParams.get("from") || new Date());
  const to = new Date(searchParams.get("to") || new Date());

  const [events, salaries] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { farmId: farm.id, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    }),
    prisma.salaryPayment.findMany({
      where: { worker: { farmId: farm.id }, dueDate: { gte: from, lte: to } },
      include: { worker: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const items = [
    ...events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      type: e.type,
      completed: e.completed,
      source: "event" as const,
    })),
    ...salaries.map((s) => ({
      id: s.id,
      title: `راتب ${s.worker.name} (${s.periodMonth})`,
      date: s.dueDate,
      type: "SALARY" as const,
      completed: s.status === "PAID",
      source: "salary" as const,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return NextResponse.json(items);
}
