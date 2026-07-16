import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET() {
  const farm = await getDefaultFarm();
  const palms = await prisma.palm.findMany({
    where: { farmId: farm.id },
    orderBy: { code: "asc" },
    include: { photos: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { diagnoses: true } } },
  });
  return NextResponse.json(palms);
}

export async function POST(req: NextRequest) {
  const farm = await getDefaultFarm();
  const body = await req.json();
  if (!body.code || !body.variety) {
    return NextResponse.json({ error: "رمز النخلة والصنف مطلوبان" }, { status: 400 });
  }
  try {
    const palm = await prisma.palm.create({
      data: {
        farmId: farm.id,
        code: body.code,
        variety: body.variety,
        plantingDate: body.plantingDate ? new Date(body.plantingDate) : null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        heightMeters: body.heightMeters ?? null,
        status: body.status ?? "HEALTHY",
        notes: body.notes ?? null,
        lastYieldKg: body.lastYieldKg ?? null,
      },
    });
    return NextResponse.json(palm, { status: 201 });
  } catch {
    return NextResponse.json({ error: "رمز النخلة مستخدم من قبل" }, { status: 409 });
  }
}
