import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const listing = await prisma.marketListing.update({
    where: { id },
    data: { status: body.status },
  });
  return NextResponse.json(listing);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.marketListing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
