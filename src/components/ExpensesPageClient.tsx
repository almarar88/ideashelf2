"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, EmptyState, StatCard } from "@/components/ui";
import { ExpenseFormModal } from "@/components/ExpenseFormModal";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";

type Expense = {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
};

export function ExpensesPageClient({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  async function remove(id: string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="مصاريف هذا الشهر" value={`${thisMonthTotal.toLocaleString()} ر.س`} icon="📆" />
        <StatCard label="إجمالي المصاريف المسجلة" value={`${total.toLocaleString()} ر.س`} icon="💰" />
      </div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAdd(true)}>+ إضافة مصروف</Button>
      </div>
      {expenses.length === 0 ? (
        <EmptyState icon="💰" message="لا توجد مصاريف مسجلة" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right text-gray-500">
                <th className="py-2">التاريخ</th>
                <th>الفئة</th>
                <th>الوصف</th>
                <th>المبلغ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]">
                  <td className="py-2">{new Date(e.date).toLocaleDateString("ar-SA-u-ca-gregory")}</td>
                  <td><Badge>{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}</Badge></td>
                  <td className="text-gray-500">{e.description || "—"}</td>
                  <td>{e.amount.toLocaleString()} ر.س</td>
                  <td>
                    <button onClick={() => remove(e.id)} className="text-red-500 hover:underline">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ExpenseFormModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
