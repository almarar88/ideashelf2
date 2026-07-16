"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, PageHeader, Field, Input } from "@/components/ui";
import { SALARY_STATUS_LABELS, WORKER_STATUS_LABELS, type SalaryStatus, type WorkerStatus } from "@/lib/constants";

type Payment = {
  id: string;
  amount: number;
  periodMonth: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
};
type Worker = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  monthlySalary: number;
  status: string;
  hireDate: string | null;
  notes: string | null;
  salaryPayments: Payment[];
};

const STATUS_COLOR: Record<string, string> = { PENDING: "#f59e0b", PAID: "#16a34a", LATE: "#dc2626" };

export function WorkerProfileClient({ worker }: { worker: Worker }) {
  const router = useRouter();
  const now = new Date();
  const [newPeriod, setNewPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [busy, setBusy] = useState(false);

  async function markPaid(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addPeriod() {
    setBusy(true);
    try {
      await fetch(`/api/workers/${worker.id}/salaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth: newPeriod }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totalPaid = worker.salaryPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const totalPending = worker.salaryPayments.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader title={worker.name} subtitle={worker.position ?? ""} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الحالة</span><Badge>{WORKER_STATUS_LABELS[worker.status as WorkerStatus] ?? worker.status}</Badge></div>
            <div className="flex justify-between"><span className="text-gray-500">الجوال</span><span>{worker.phone || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الراتب الشهري</span><span>{worker.monthlySalary.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between"><span className="text-gray-500">تاريخ التعيين</span><span>{worker.hireDate ? new Date(worker.hireDate).toLocaleDateString("ar-SA-u-ca-gregory") : "—"}</span></div>
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">إجمالي المدفوع</div>
          <div className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()} ر.س</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">مستحقات معلقة</div>
          <div className="text-2xl font-bold text-amber-600">{totalPending.toLocaleString()} ر.س</div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">سجل الرواتب</h2>
          <div className="flex items-center gap-2">
            <Field label="">
              <Input type="month" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} />
            </Field>
            <Button onClick={addPeriod} disabled={busy}>+ إضافة شهر</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right text-gray-500">
                <th className="py-2">الشهر</th>
                <th>المبلغ</th>
                <th>تاريخ الاستحقاق</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {worker.salaryPayments.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]">
                  <td className="py-2">{p.periodMonth}</td>
                  <td>{p.amount.toLocaleString()} ر.س</td>
                  <td>{new Date(p.dueDate).toLocaleDateString("ar-SA-u-ca-gregory")}</td>
                  <td><Badge color={STATUS_COLOR[p.status]}>{SALARY_STATUS_LABELS[p.status as SalaryStatus] ?? p.status}</Badge></td>
                  <td>
                    {p.status !== "PAID" && (
                      <Button variant="secondary" onClick={() => markPaid(p.id)} disabled={busy}>
                        تسجيل كمدفوع
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
