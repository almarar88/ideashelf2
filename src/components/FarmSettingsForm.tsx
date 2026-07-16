"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { LocationPickerMap } from "@/components/LocationPickerMapLoader";

type Farm = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  areaHectares: number | null;
};

export function FarmSettingsForm({ farm }: { farm: Farm }) {
  const router = useRouter();
  const [name, setName] = useState(farm.name);
  const [description, setDescription] = useState(farm.description ?? "");
  const [address, setAddress] = useState(farm.address ?? "");
  const [areaHectares, setAreaHectares] = useState(farm.areaHectares?.toString() ?? "");
  const [lat, setLat] = useState(farm.lat ?? 24.7136);
  const [lng, setLng] = useState(farm.lng ?? 46.6753);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/farm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          address,
          areaHectares: areaHectares ? Number(areaHectares) : null,
          lat,
          lng,
        }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المزرعة">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="العنوان">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="المساحة (هكتار)">
          <Input
            type="number"
            step="0.1"
            value={areaHectares}
            onChange={(e) => setAreaHectares(e.target.value)}
          />
        </Field>
        <Field label="الإحداثيات">
          <Input readOnly value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`} />
        </Field>
      </div>
      <Field label="الوصف">
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="حدد موقع المزرعة على الخريطة">
        <LocationPickerMap lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </Button>
        {saved && <span className="text-sm text-green-600">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
