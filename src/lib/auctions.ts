import { prisma } from "@/lib/prisma";

export async function syncAuctionStatuses() {
  const now = new Date();
  await prisma.auction.updateMany({
    where: { status: "SCHEDULED", startAt: { lte: now } },
    data: { status: "ACTIVE" },
  });

  const endingAuctions = await prisma.auction.findMany({
    where: { status: "ACTIVE", endAt: { lte: now } },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  for (const auction of endingAuctions) {
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: "ENDED", winnerName: auction.bids[0]?.bidderName ?? null },
    });
  }
}
