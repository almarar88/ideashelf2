import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MarketListingDetailClient } from "@/components/MarketListingDetailClient";

export default async function MarketListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.marketListing.findUnique({ where: { id } });
  if (!listing) notFound();
  return <MarketListingDetailClient listing={listing} />;
}
