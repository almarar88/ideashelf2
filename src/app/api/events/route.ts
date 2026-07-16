import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET(req: NextRequest) {
  const farm = await getDefaultFarm();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const events = await prisma.calendarEvent.findMany({
    where: {
      farmId: farm.id,
      ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
    },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const farm = await getDefaultFarm();
  const body = await req.json();
  if (!body.title || !body.date) {
    return NextResponse.json({ error: "العنوان والتاريخ مطلوبان" }, { status: 400 });
  }
  const event = await prisma.calendarEvent.create({
    data: {
      farmId: farm.id,
      title: body.title,
      date: new Date(body.date),
      type: body.type ?? "OTHER",
      notes: body.notes ?? null,
      recurrence: body.recurrence ?? "NONE",
    },
  });
  return NextResponse.json(event, { status: 201 });
}
