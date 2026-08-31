"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, PageHeader } from "@/components/ui";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { PalmEditModal } from "@/components/PalmEditModal";
import { DiseaseDetector } from "@/components/DiseaseDetector";
import { LocationPickerMap } from "@/components/LocationPickerMapLoader";
import {
  PALM_STATUS_LABELS,
  PALM_STATUS_COLORS,
  DIAGNOSIS_STATUS_LABELS,
  DIAGNOSIS_STATUSES,
  type PalmStatus,
  type DiagnosisStatus,
} from "@/lib/constants";

type Photo = { id: string; url: string; caption: string | null; takenAt: string };
type Diagnosis = {
  id: string;
  diseaseName: string;
  confidence: number | null;
  severity: string | null;
  symptoms: string | null;
  treatment: string | null;
  prevention: string | null;
  status: string;
  createdAt: string;
};
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
  plantingDate: string | null;
  photos: Photo[];
  diagnoses: Diagnosis[];
};

export function PalmProfileClient({ palm }: { palm: Palm }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function addPhotos(images: UploadedImage[]) {
    const latest = images[images.length - 1];
    if (!latest) return;
    await fetch(`/api/palms/${palm.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: latest.url }),
    });
    router.refresh();
  }

  async function updateDiagnosisStatus(id: string, status: string) {
    await fetch(`/api/diagnoses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deletePalm() {
    if (!confirm(`هل أنت متأكد من حذف النخلة ${palm.code}؟`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/palms/${palm.id}`, { method: "DELETE" });
      router.push("/palms");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`نخلة ${palm.code}`}
        subtitle={palm.variety}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>✏️ تعديل</Button>
            <Button variant="danger" onClick={deletePalm} disabled={deleting}>🗑️ حذف</Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">الحالة</span>
              <Badge color={PALM_STATUS_COLORS[palm.status as PalmStatus]}>
                {PALM_STATUS_LABELS[palm.status as PalmStatus] ?? palm.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">تاريخ الزراعة</span>
              <span>{palm.plantingDate ? new Date(palm.plantingDate).toLocaleDateString("ar-SA-u-ca-gregory") : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الارتفاع</span>
              <span>{palm.heightMeters ? `${Math.round(palm.heightMeters * 10) / 10} م` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">آخر إنتاجية</span>
              <span>{palm.lastYieldKg ? `${palm.lastYieldKg} كجم` : "—"}</span>
            </div>
            {palm.notes && (
              <div>
                <div className="text-gray-500">ملاحظات</div>
                <p className="mt-1">{palm.notes}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-bold">موقع النخلة</h2>
          {palm.lat && palm.lng ? (
            <LocationPickerMap lat={palm.lat} lng={palm.lng} onChange={() => {}} height={220} />
          ) : (
            <p className="text-sm text-gray-400">لم يتم تحديد موقع بعد</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-bold">معرض الصور ({palm.photos.length})</h2>
        <ImageUploader images={palm.photos.map((p) => ({ url: p.url }))} onChange={addPhotos} />
      </Card>

      <div className="mt-6">
        <DiseaseDetector palmId={palm.id} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-bold">سجل الفحوصات والتشخيصات ({palm.diagnoses.length})</h2>
        {palm.diagnoses.length === 0 ? (
          <p className="text-sm text-gray-400">لا يوجد سجل تشخيصات بعد</p>
        ) : (
          <div className="space-y-3">
            {palm.diagnoses.map((d) => (
              <div key={d.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{d.diseaseName}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(d.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </span>
                    <select
                      value={d.status}
                      onChange={(e) => updateDiagnosisStatus(d.id, e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
                    >
                      {DIAGNOSIS_STATUSES.map((s) => (
                        <option key={s} value={s}>{DIAGNOSIS_STATUS_LABELS[s as DiagnosisStatus]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {d.treatment && <p className="mt-2 text-sm text-gray-500">💊 {d.treatment}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <PalmEditModal open={editOpen} onClose={() => setEditOpen(false)} palm={palm} />
    </div>
  );
}
