"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { WORKER_STATUSES, WORKER_STATUS_LABELS } from "@/lib/constants";

export function WorkerFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, position, monthlySalary, hireDate: hireDate || null, status, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل الحفظ");
      }
      onClose();
      router.refresh();
      setName(""); setPhone(""); setPosition(""); setMonthlySalary(""); setHireDate(""); setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة عامل جديد">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="رقم الجوال">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="الوظيفة">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="مثال: عامل ري" />
          </Field>
          <Field label="الراتب الشهري">
            <Input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} />
          </Field>
          <Field label="تاريخ التعيين">
            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </Field>
          <Field label="الحالة">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {WORKER_STATUSES.map((s) => (
                <option key={s} value={s}>{WORKER_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
