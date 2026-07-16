"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, PageHeader, Field, Input } from "@/components/ui";
import { AUCTION_STATUS_LABELS, type AuctionStatus } from "@/lib/constants";

type Bid = { id: string; bidderName: string; amount: number; createdAt: string };
type Auction = {
  id: string;
  title: string;
  description: string | null;
  variety: string | null;
  images: string | null;
  startPrice: number;
  currentPrice: number;
  bidStep: number;
  startAt: string;
  endAt: string;
  status: string;
  winnerName: string | null;
  bids: Bid[];
};

function useCountdown(target: string) {
  const [remaining, setRemaining] = useState(() => new Date(target).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setRemaining(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (remaining <= 0) return "انتهى";
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  return `${days ? `${days}ي ` : ""}${hours}س ${minutes}د ${seconds}ث`;
}

export function AuctionDetailClient({ auction }: { auction: Auction }) {
  const router = useRouter();
  const countdown = useCountdown(auction.endAt);
  const images: string[] = auction.images ? JSON.parse(auction.images) : [];
  const [bidderName, setBidderName] = useState("");
  const [bidderContact, setBidderContact] = useState("");
  const [amount, setAmount] = useState((auction.currentPrice + auction.bidStep).toString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auction.status !== "ACTIVE") return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [auction.status, router]);

  async function placeBid() {
    setError("");
    if (!bidderName) { setError("اسم المزايد مطلوب"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/auctions/${auction.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidderName, bidderContact, amount: Number(amount) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشلت المزايدة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={auction.title} subtitle={auction.variety ?? ""} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {images.length > 0 ? (
            <div className="relative h-64 w-full overflow-hidden rounded-lg">
              <Image src={images[0]} alt={auction.title} fill className="object-cover" />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-5xl">🔨</div>
          )}
          {auction.description && <p className="mt-3 text-sm text-gray-500">{auction.description}</p>}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">الحالة</span>
              <Badge>{AUCTION_STATUS_LABELS[auction.status as AuctionStatus]}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-gray-500">السعر الحالي</span>
              <span className="text-2xl font-bold text-[var(--primary)]">{auction.currentPrice.toLocaleString()} ر.س</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">{auction.status === "ENDED" ? "انتهى المزاد" : "الوقت المتبقي"}</span>
              <span className="font-mono">{auction.status === "ENDED" ? "" : countdown}</span>
            </div>
            {auction.status === "ENDED" && (
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)] p-2 text-center text-sm">
                {auction.winnerName ? `🏆 الفائز: ${auction.winnerName}` : "لم يتم تقديم أي مزايدة"}
              </div>
            )}
          </Card>

          {auction.status === "ACTIVE" && (
            <Card>
              <h3 className="mb-2 font-bold">قدّم مزايدتك</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="الاسم"><Input value={bidderName} onChange={(e) => setBidderName(e.target.value)} /></Field>
                <Field label="رقم التواصل"><Input value={bidderContact} onChange={(e) => setBidderContact(e.target.value)} /></Field>
              </div>
              <Field label={`المبلغ (الحد الأدنى ${auction.currentPrice + auction.bidStep})`}>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
              <Button className="mt-2 w-full" onClick={placeBid} disabled={saving}>
                {saving ? "جارٍ الإرسال..." : "تقديم مزايدة"}
              </Button>
            </Card>
          )}

          <Card>
            <h3 className="mb-2 font-bold">سجل المزايدات ({auction.bids.length})</h3>
            {auction.bids.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد مزايدات بعد</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {auction.bids.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2 text-sm">
                    <span>{i === 0 && "🏆 "}{b.bidderName}</span>
                    <span className="font-bold">{b.amount.toLocaleString()} ر.س</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
