import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.url) return NextResponse.json({ error: "الرابط مطلوب" }, { status: 400 });
  const photo = await prisma.palmPhoto.create({
    data: { palmId: id, url: body.url, caption: body.caption ?? null },
  });
  return NextResponse.json(photo, { status: 201 });
}
