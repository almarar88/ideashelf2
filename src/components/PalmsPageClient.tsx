"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, Badge, Button, Input, Select, EmptyState } from "@/components/ui";
import { PalmsMap } from "@/components/PalmsMapLoader";
import { PalmFormModal } from "@/components/PalmFormModal";
import { PALM_STATUSES, PALM_STATUS_LABELS, PALM_STATUS_COLORS, type PalmStatus } from "@/lib/constants";

type Palm = {
  id: string;
  code: string;
  variety: string;
  status: string;
  lat: number | null;
  lng: number | null;
  heightMeters: number | null;
  plantingDate: string | null;
  photos: { url: string }[];
  _count: { diagnoses: number };
};

export function PalmsPageClient({
  palms,
  farmCenter,
}: {
  palms: Palm[];
  farmCenter: [number, number];
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    return palms.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (search && !`${p.code} ${p.variety}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [palms, search, statusFilter]);

  const nextCode = `P-${String(palms.length + 1).padStart(3, "0")}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="بحث برمز النخلة أو الصنف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="">كل الحالات</option>
          {PALM_STATUSES.map((s) => (
            <option key={s} value={s}>{PALM_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <div className="mr-auto flex gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-1 text-sm">
            <button
              className={`rounded-md px-3 py-1 ${view === "list" ? "bg-[var(--primary)] text-white" : ""}`}
              onClick={() => setView("list")}
            >
              قائمة
            </button>
            <button
              className={`rounded-md px-3 py-1 ${view === "map" ? "bg-[var(--primary)] text-white" : ""}`}
              onClick={() => setView("map")}
            >
              خريطة
            </button>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ إضافة نخلة</Button>
        </div>
      </div>

      {view === "map" ? (
        <Card>
          <PalmsMap palms={filtered} center={farmCenter} height={520} />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🌴" message="لا توجد نخيل مطابقة" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/palms/${p.id}`}>
              <Card className="flex h-full gap-3 transition hover:shadow-md">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
                  {p.photos[0] ? (
                    <Image src={p.photos[0].url} alt={p.code} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🌴</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{p.code}</span>
                    <Badge color={PALM_STATUS_COLORS[p.status as PalmStatus]}>
                      {PALM_STATUS_LABELS[p.status as PalmStatus] ?? p.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">{p.variety}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {p.heightMeters ? `الارتفاع: ${Math.round(p.heightMeters * 10) / 10}م` : ""}
                    {p._count.diagnoses > 0 ? ` • ${p._count.diagnoses} تشخيص` : ""}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <PalmFormModal open={showAdd} onClose={() => setShowAdd(false)} farmCenter={farmCenter} nextCode={nextCode} />
    </div>
  );
}
