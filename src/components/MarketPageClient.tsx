"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, Badge, Button, Input, Select, EmptyState } from "@/components/ui";
import { MarketListingFormModal } from "@/components/MarketListingFormModal";
import { LISTING_TYPE_LABELS, LISTING_STATUS_LABELS, type ListingType, type ListingStatus } from "@/lib/constants";

type Listing = {
  id: string;
  type: string;
  title: string;
  variety: string | null;
  price: number | null;
  quantity: number;
  unit: string;
  images: string | null;
  sellerName: string;
  location: string | null;
  status: string;
};

export function MarketPageClient({ listings }: { listings: Listing[] }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (typeFilter && l.type !== typeFilter) return false;
        if (search && !`${l.title} ${l.variety ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [listings, typeFilter, search]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[160px]">
          <option value="">الكل</option>
          <option value="SELL">للبيع</option>
          <option value="BUY">مطلوب للشراء</option>
        </Select>
        <Button className="mr-auto" onClick={() => setShowAdd(true)}>+ إعلان جديد</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🛒" message="لا توجد إعلانات مطابقة" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const images: string[] = l.images ? JSON.parse(l.images) : [];
            return (
              <Link key={l.id} href={`/market/${l.id}`}>
                <Card className="h-full transition hover:shadow-md">
                  <div className="relative mb-2 h-32 w-full overflow-hidden rounded-lg bg-[var(--surface-muted)]">
                    {images[0] ? (
                      <Image src={images[0]} alt={l.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🌱</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge color={l.type === "SELL" ? "#16a34a" : "#0ea5e9"}>
                        {LISTING_TYPE_LABELS[l.type as ListingType]}
                      </Badge>
                    </div>
                  </div>
                  <div className="font-bold">{l.title}</div>
                  <div className="text-sm text-gray-500">{l.variety} • {l.quantity} {l.unit}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-[var(--primary)]">
                      {l.price ? `${l.price.toLocaleString()} ر.س` : "السعر عند التواصل"}
                    </span>
                    <Badge>{LISTING_STATUS_LABELS[l.status as ListingStatus]}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <MarketListingFormModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
