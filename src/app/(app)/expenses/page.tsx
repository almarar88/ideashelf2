import { getDefaultFarm } from "@/lib/farm";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ExpensesPageClient } from "@/components/ExpensesPageClient";

export default async function ExpensesPage() {
  const farm = await getDefaultFarm();
  const expenses = await prisma.expense.findMany({
    where: { farmId: farm.id },
    orderBy: { date: "desc" },
  });

  const serialized = expenses.map((e) => ({ ...e, date: e.date.toISOString() }));

  return (
    <div>
      <PageHeader title="المصاريف" subtitle="سجل جميع مصاريف تشغيل المزرعة" />
      <ExpensesPageClient expenses={serialized} />
    </div>
  );
}
