import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncAuctionStatuses } from "@/lib/auctions";
import { AuctionDetailClient } from "@/components/AuctionDetailClient";

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await syncAuctionStatuses();
  const { id } = await params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { bids: { orderBy: { amount: "desc" } } },
  });
  if (!auction) notFound();

  const serialized = {
    ...auction,
    startAt: auction.startAt.toISOString(),
    endAt: auction.endAt.toISOString(),
    bids: auction.bids.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
  };

  return <AuctionDetailClient auction={serialized} />;
}
