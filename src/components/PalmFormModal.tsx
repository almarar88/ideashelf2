"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { LocationPickerMap } from "@/components/LocationPickerMapLoader";
import { PALM_STATUSES, PALM_STATUS_LABELS, PALM_VARIETIES } from "@/lib/constants";

export function PalmFormModal({
  open,
  onClose,
  farmCenter,
  nextCode,
}: {
  open: boolean;
  onClose: () => void;
  farmCenter: [number, number];
  nextCode: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(nextCode);
  const [variety, setVariety] = useState(PALM_VARIETIES[0]);
  const [plantingDate, setPlantingDate] = useState("");
  const [heightMeters, setHeightMeters] = useState("");
  const [status, setStatus] = useState<string>("HEALTHY");
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState(farmCenter[0]);
  const [lng, setLng] = useState(farmCenter[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/palms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          variety,
          plantingDate: plantingDate || null,
          heightMeters: heightMeters ? Number(heightMeters) : null,
          status,
          notes,
          lat,
          lng,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل الحفظ");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة نخلة جديدة">
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
          <Field label="تاريخ الزراعة">
            <Input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
          </Field>
          <Field label="الارتفاع (متر)">
            <Input type="number" step="0.1" value={heightMeters} onChange={(e) => setHeightMeters(e.target.value)} />
          </Field>
          <Field label="الحالة">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {PALM_STATUSES.map((s) => (
                <option key={s} value={s}>{PALM_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="موقع النخلة على الخريطة">
          <LocationPickerMap lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} height={220} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </div>
    </Modal>
  );
}
