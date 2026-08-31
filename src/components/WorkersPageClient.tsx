"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { WorkerFormModal } from "@/components/WorkerFormModal";
import { WORKER_STATUS_LABELS, SALARY_STATUS_LABELS, type WorkerStatus, type SalaryStatus } from "@/lib/constants";

type Worker = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  monthlySalary: number;
  status: string;
  salaryPayments: { status: string; periodMonth: string }[];
};

export function WorkersPageClient({ workers }: { workers: Worker[] }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAdd(true)}>+ إضافة عامل</Button>
      </div>
      {workers.length === 0 ? (
        <EmptyState icon="👷" message="لا يوجد عمال مسجلون" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((w) => {
            const latest = w.salaryPayments[0];
            return (
              <Link key={w.id} href={`/workers/${w.id}`}>
                <Card className="h-full transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{w.name}</span>
                    <Badge color={w.status === "ACTIVE" ? "#16a34a" : "#64748b"}>
                      {WORKER_STATUS_LABELS[w.status as WorkerStatus] ?? w.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">{w.position || "—"}</div>
                  <div className="mt-2 text-sm">الراتب الشهري: {w.monthlySalary.toLocaleString()} ر.س</div>
                  {latest && (
                    <div className="mt-1 text-xs text-gray-400">
                      آخر راتب ({latest.periodMonth}): {SALARY_STATUS_LABELS[latest.status as SalaryStatus] ?? latest.status}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <WorkerFormModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
