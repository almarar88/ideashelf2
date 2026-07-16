"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, PageHeader } from "@/components/ui";
import { LISTING_TYPE_LABELS, LISTING_STATUS_LABELS, LISTING_STATUSES, type ListingType, type ListingStatus } from "@/lib/constants";

type Listing = {
  id: string;
  type: string;
  title: string;
  variety: string | null;
  description: string | null;
  price: number | null;
  quantity: number;
  unit: string;
  images: string | null;
  sellerName: string;
  contact: string | null;
  location: string | null;
  status: string;
};

export function MarketListingDetailClient({ listing }: { listing: Listing }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const images: string[] = listing.images ? JSON.parse(listing.images) : [];

  async function updateStatus(status: string) {
    setBusy(true);
    try {
      await fetch(`/api/market/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("هل تريد حذف هذا الإعلان؟")) return;
    await fetch(`/api/market/${listing.id}`, { method: "DELETE" });
    router.push("/market");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={listing.title}
        subtitle={`${listing.variety ?? ""} • ${listing.quantity} ${listing.unit}`}
        action={<Button variant="danger" onClick={remove}>🗑️ حذف الإعلان</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative h-40 overflow-hidden rounded-lg">
                  <Image src={img} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-4xl">🌱</div>
          )}
        </Card>
        <Card className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">النوع</span>
            <Badge color={listing.type === "SELL" ? "#16a34a" : "#0ea5e9"}>{LISTING_TYPE_LABELS[listing.type as ListingType]}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">السعر</span>
            <span className="font-bold text-[var(--primary)]">{listing.price ? `${listing.price.toLocaleString()} ر.س` : "عند التواصل"}</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-500">البائع/المشتري</span><span>{listing.sellerName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">التواصل</span><span>{listing.contact || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">الموقع</span><span>{listing.location || "—"}</span></div>
          {listing.description && (
            <div>
              <div className="text-gray-500">الوصف</div>
              <p className="mt-1">{listing.description}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-gray-500">الحالة</span>
            <select
              value={listing.status}
              disabled={busy}
              onChange={(e) => updateStatus(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
            >
              {LISTING_STATUSES.map((s) => (
                <option key={s} value={s}>{LISTING_STATUS_LABELS[s as ListingStatus]}</option>
              ))}
            </select>
          </div>
        </Card>
      </div>
    </div>
  );
}
