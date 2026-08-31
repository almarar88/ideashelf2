import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAuctionStatuses } from "@/lib/auctions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await syncAuctionStatuses();
  const { id } = await params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { bids: { orderBy: { amount: "desc" } } },
  });
  if (!auction) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(auction);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.auction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
