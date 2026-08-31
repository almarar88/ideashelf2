import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { MarketPageClient } from "@/components/MarketPageClient";

export default async function MarketPage() {
  const listings = await prisma.marketListing.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="سوق الفسائل والنخيل" subtitle="بيع وشراء فسائل النخيل مباشرة بين المزارعين" />
      <MarketPageClient listings={listings} />
    </div>
  );
}
