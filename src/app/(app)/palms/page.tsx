import { getDefaultFarm } from "@/lib/farm";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { PalmsPageClient } from "@/components/PalmsPageClient";

export default async function PalmsPage() {
  const farm = await getDefaultFarm();
  const palms = await prisma.palm.findMany({
    where: { farmId: farm.id },
    orderBy: { code: "asc" },
    include: { photos: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { diagnoses: true } } },
  });

  const serialized = palms.map((p) => ({
    ...p,
    plantingDate: p.plantingDate?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="النخيل"
        subtitle={`إجمالي عدد النخيل: ${palms.length}`}
      />
      <PalmsPageClient
        palms={serialized}
        farmCenter={[farm.lat ?? 24.7136, farm.lng ?? 46.6753]}
      />
    </div>
  );
}
