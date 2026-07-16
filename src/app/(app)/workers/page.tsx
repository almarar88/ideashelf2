import { getDefaultFarm } from "@/lib/farm";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { WorkersPageClient } from "@/components/WorkersPageClient";

export default async function WorkersPage() {
  const farm = await getDefaultFarm();
  const workers = await prisma.worker.findMany({
    where: { farmId: farm.id },
    orderBy: { createdAt: "asc" },
    include: { salaryPayments: { orderBy: { dueDate: "desc" }, take: 1 } },
  });

  return (
    <div>
      <PageHeader title="العمال" subtitle={`إجمالي عدد العمال: ${workers.length}`} />
      <WorkersPageClient workers={workers} />
    </div>
  );
}
