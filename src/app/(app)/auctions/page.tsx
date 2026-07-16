import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { AuctionsPageClient } from "@/components/AuctionsPageClient";
import { syncAuctionStatuses } from "@/lib/auctions";

export default async function AuctionsPage() {
  await syncAuctionStatuses();
  const auctions = await prisma.auction.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: true } } },
  });
  const serialized = auctions.map((a) => ({ ...a, endAt: a.endAt.toISOString() }));

  return (
    <div>
      <PageHeader title="مزادات النخيل والفسائل" subtitle="زايد على أفضل الفسائل والنخيل النادرة" />
      <AuctionsPageClient auctions={serialized} />
    </div>
  );
}
