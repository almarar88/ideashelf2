"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { LISTING_TYPES, LISTING_TYPE_LABELS, PALM_VARIETIES } from "@/lib/constants";

export function MarketListingFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<string>("SELL");
  const [title, setTitle] = useState("");
  const [variety, setVariety] = useState(PALM_VARIETIES[0]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellerName, setSellerName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title || !sellerName) { setError("العنوان واسم البائع مطلوبان"); return; }
    setSaving(true);
    setError("");
    try {
      await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, title, variety, description, price, quantity, sellerName, contact, location,
          images: images.map((i) => i.url),
        }),
      });
      onClose();
      router.refresh();
      setTitle(""); setDescription(""); setPrice(""); setSellerName(""); setContact(""); setLocation(""); setImages([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة إعلان جديد">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="النوع">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {LISTING_TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="الصنف">
            <Select value={variety} onChange={(e) => setVariety(e.target.value)}>
              {PALM_VARIETIES.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="عنوان الإعلان">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: فسائل نخيل خلاص للبيع" />
        </Field>
        <Field label="الوصف">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="السعر (ر.س)">
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="الكمية">
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="اسم البائع/المشتري">
            <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
          </Field>
          <Field label="رقم التواصل">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
        </div>
        <Field label="الموقع">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="المدينة / المنطقة" />
        </Field>
        <Field label="الصور">
          <ImageUploader images={images} onChange={setImages} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ النشر..." : "نشر الإعلان"}</Button>
        </div>
      </div>
    </Modal>
  );
}
