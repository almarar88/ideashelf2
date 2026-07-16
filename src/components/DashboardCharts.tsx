"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card } from "@/components/ui";
import { PALM_STATUS_LABELS, PALM_STATUS_COLORS, EXPENSE_CATEGORY_LABELS, type PalmStatus, type ExpenseCategory } from "@/lib/constants";

export function PalmStatusChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: PALM_STATUS_LABELS[status as PalmStatus] ?? status,
      value,
      color: PALM_STATUS_COLORS[status as PalmStatus] ?? "#64748b",
    }));

  if (data.length === 0) return <p className="text-sm text-gray-400">لا توجد بيانات</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ExpensesByCategoryChart({ data }: { data: { category: string; total: number }[] }) {
  const chartData = data.map((d) => ({
    name: EXPENSE_CATEGORY_LABELS[d.category as ExpenseCategory] ?? d.category,
    total: d.total,
  }));

  if (chartData.length === 0) return <p className="text-sm text-gray-400">لا توجد بيانات</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="total" fill="#2f6b3a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DashboardChartsGrid({
  statusCounts,
  expensesByCategory,
}: {
  statusCounts: Record<string, number>;
  expensesByCategory: { category: string; total: number }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-2 font-bold">توزيع حالة النخيل</h2>
        <PalmStatusChart counts={statusCounts} />
      </Card>
      <Card>
        <h2 className="mb-2 font-bold">المصاريف حسب الفئة</h2>
        <ExpensesByCategoryChart data={expensesByCategory} />
      </Card>
    </div>
  );
}
