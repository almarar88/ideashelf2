import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const palm = await prisma.palm.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { createdAt: "desc" } },
      diagnoses: { orderBy: { createdAt: "desc" }, include: { photo: true } },
    },
  });
  if (!palm) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(palm);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    "code",
    "variety",
    "lat",
    "lng",
    "heightMeters",
    "status",
    "notes",
    "lastYieldKg",
  ]) {
    if (key in body) data[key] = body[key];
  }
  if ("plantingDate" in body) {
    data.plantingDate = body.plantingDate ? new Date(body.plantingDate) : null;
  }
  const palm = await prisma.palm.update({ where: { id }, data });
  return NextResponse.json(palm);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.palm.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
