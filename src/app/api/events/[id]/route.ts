import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["title", "notes", "type", "recurrence", "completed"]) {
    if (key in body) data[key] = body[key];
  }
  if ("date" in body) data.date = new Date(body.date);
  const event = await prisma.calendarEvent.update({ where: { id }, data });
  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
