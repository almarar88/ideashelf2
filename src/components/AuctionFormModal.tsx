"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { PALM_VARIETIES } from "@/lib/constants";

export function AuctionFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [variety, setVariety] = useState(PALM_VARIETIES[0]);
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [bidStep, setBidStep] = useState("25");
  const [startAt, setStartAt] = useState(inHour.toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(in3Days.toISOString().slice(0, 16));
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title || !startPrice) { setError("العنوان والسعر الابتدائي مطلوبان"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, variety, description, startPrice, bidStep,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          images: images.map((i) => i.url),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إنشاء مزاد جديد">
      <div className="space-y-4">
        <Field label="عنوان المزاد">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الصنف">
            <Select value={variety} onChange={(e) => setVariety(e.target.value)}>
              {PALM_VARIETIES.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
          <Field label="السعر الابتدائي">
            <Input type="number" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} />
          </Field>
          <Field label="الحد الأدنى للمزايدة">
            <Input type="number" value={bidStep} onChange={(e) => setBidStep(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="وقت البدء">
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label="وقت الانتهاء">
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </Field>
        </div>
        <Field label="الوصف">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="الصور">
          <ImageUploader images={images} onChange={setImages} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الإنشاء..." : "إنشاء المزاد"}</Button>
        </div>
      </div>
    </Modal>
  );
}
