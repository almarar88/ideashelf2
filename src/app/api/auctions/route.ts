import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAuctionStatuses } from "@/lib/auctions";

export async function GET() {
  await syncAuctionStatuses();
  const auctions = await prisma.auction.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: true } } },
  });
  return NextResponse.json(auctions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.startPrice || !body.startAt || !body.endAt) {
    return NextResponse.json({ error: "العنوان والسعر الابتدائي وتواريخ البداية والنهاية مطلوبة" }, { status: 400 });
  }
  const auction = await prisma.auction.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      variety: body.variety ?? null,
      images: body.images ? JSON.stringify(body.images) : null,
      startPrice: Number(body.startPrice),
      currentPrice: Number(body.startPrice),
      bidStep: body.bidStep ? Number(body.bidStep) : 10,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      status: new Date(body.startAt) <= new Date() ? "ACTIVE" : "SCHEDULED",
    },
  });
  return NextResponse.json(auction, { status: 201 });
}
