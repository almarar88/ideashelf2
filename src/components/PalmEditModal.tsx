"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { LocationPickerMap } from "@/components/LocationPickerMapLoader";
import { PALM_STATUSES, PALM_STATUS_LABELS, PALM_VARIETIES } from "@/lib/constants";

type Palm = {
  id: string;
  code: string;
  variety: string;
  status: string;
  notes: string | null;
  heightMeters: number | null;
  lastYieldKg: number | null;
  lat: number | null;
  lng: number | null;
};

export function PalmEditModal({ open, onClose, palm }: { open: boolean; onClose: () => void; palm: Palm }) {
  const router = useRouter();
  const [code, setCode] = useState(palm.code);
  const [variety, setVariety] = useState(palm.variety);
  const [status, setStatus] = useState(palm.status);
  const [notes, setNotes] = useState(palm.notes ?? "");
  const [heightMeters, setHeightMeters] = useState(palm.heightMeters?.toString() ?? "");
  const [lastYieldKg, setLastYieldKg] = useState(palm.lastYieldKg?.toString() ?? "");
  const [lat, setLat] = useState(palm.lat ?? 24.7136);
  const [lng, setLng] = useState(palm.lng ?? 46.6753);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/palms/${palm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          variety,
          status,
          notes,
          heightMeters: heightMeters ? Number(heightMeters) : null,
          lastYieldKg: lastYieldKg ? Number(lastYieldKg) : null,
          lat,
          lng,
        }),
      });
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`تعديل بيانات ${palm.code}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="رمز النخلة">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="الصنف">
            <Select value={variety} onChange={(e) => setVariety(e.target.value)}>
              {PALM_VARIETIES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {PALM_STATUSES.map((s) => (
                <option key={s} value={s}>{PALM_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="الارتفاع (متر)">
            <Input type="number" step="0.1" value={heightMeters} onChange={(e) => setHeightMeters(e.target.value)} />
          </Field>
          <Field label="آخر إنتاجية (كجم)">
            <Input type="number" step="0.5" value={lastYieldKg} onChange={(e) => setLastYieldKg(e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="الموقع">
          <LocationPickerMap lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} height={220} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </div>
    </Modal>
  );
}
