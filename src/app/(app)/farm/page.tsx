import { getDefaultFarm } from "@/lib/farm";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { FarmSettingsForm } from "@/components/FarmSettingsForm";
import { PalmsMap } from "@/components/PalmsMapLoader";

export default async function FarmPage() {
  const farm = await getDefaultFarm();
  const palms = await prisma.palm.findMany({
    where: { farmId: farm.id },
    select: { id: true, code: true, variety: true, status: true, lat: true, lng: true },
  });

  const center: [number, number] = [farm.lat ?? 24.7136, farm.lng ?? 46.6753];

  return (
    <div>
      <PageHeader title="خريطة المزرعة والموقع" subtitle="حدد موقع مزرعتك واستعرض توزيع النخيل عليها" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">موقع المزرعة</h2>
          <FarmSettingsForm farm={farm} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">خريطة توزيع النخيل ({palms.length})</h2>
          <PalmsMap
            palms={palms}
            center={center}
            farmMarker={{ lat: center[0], lng: center[1], areaHectares: farm.areaHectares }}
          />
        </Card>
      </div>
    </div>
  );
}
