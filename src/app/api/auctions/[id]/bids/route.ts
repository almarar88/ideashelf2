import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAuctionStatuses } from "@/lib/auctions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await syncAuctionStatuses();
  const { id } = await params;
  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (auction.status !== "ACTIVE") {
    return NextResponse.json({ error: "المزاد غير نشط حاليًا" }, { status: 400 });
  }

  const body = await req.json();
  const amount = Number(body.amount);
  const minAmount = auction.currentPrice + auction.bidStep;
  if (!body.bidderName || !amount || amount < minAmount) {
    return NextResponse.json({ error: `الحد الأدنى للمزايدة هو ${minAmount} ر.س` }, { status: 400 });
  }

  const bid = await prisma.bid.create({
    data: {
      auctionId: id,
      bidderName: body.bidderName,
      bidderContact: body.bidderContact ?? null,
      amount,
    },
  });
  await prisma.auction.update({ where: { id }, data: { currentPrice: amount } });

  return NextResponse.json(bid, { status: 201 });
}
