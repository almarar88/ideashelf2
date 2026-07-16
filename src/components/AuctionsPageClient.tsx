"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { AuctionFormModal } from "@/components/AuctionFormModal";
import { AUCTION_STATUS_LABELS, type AuctionStatus } from "@/lib/constants";

type Auction = {
  id: string;
  title: string;
  variety: string | null;
  images: string | null;
  currentPrice: number;
  status: string;
  endAt: string;
  _count: { bids: number };
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#64748b",
  ACTIVE: "#16a34a",
  ENDED: "#dc2626",
  CANCELLED: "#64748b",
};

export function AuctionsPageClient({ auctions }: { auctions: Auction[] }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAdd(true)}>+ مزاد جديد</Button>
      </div>
      {auctions.length === 0 ? (
        <EmptyState icon="🔨" message="لا توجد مزادات حاليًا" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((a) => {
            const images: string[] = a.images ? JSON.parse(a.images) : [];
            return (
              <Link key={a.id} href={`/auctions/${a.id}`}>
                <Card className="h-full transition hover:shadow-md">
                  <div className="relative mb-2 h-32 w-full overflow-hidden rounded-lg bg-[var(--surface-muted)]">
                    {images[0] ? (
                      <Image src={images[0]} alt={a.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🔨</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge color={STATUS_COLOR[a.status]}>{AUCTION_STATUS_LABELS[a.status as AuctionStatus]}</Badge>
                    </div>
                  </div>
                  <div className="font-bold">{a.title}</div>
                  <div className="text-sm text-gray-500">{a.variety}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-[var(--primary)]">{a.currentPrice.toLocaleString()} ر.س</span>
                    <span className="text-xs text-gray-400">{a._count.bids} مزايدة</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <AuctionFormModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
