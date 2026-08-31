import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DiseaseDetector } from "@/components/DiseaseDetector";
import { DIAGNOSIS_STATUS_LABELS, type DiagnosisStatus } from "@/lib/constants";
import Link from "next/link";

export default async function DiseaseDetectionPage() {
  const reports = await prisma.diagnosisReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { palm: true },
  });

  return (
    <div>
      <PageHeader
        title="كشف الأمراض بالذكاء الاصطناعي"
        subtitle="ارفع صورة لأي نخلة لتحليلها فورًا، أو افتح ملف نخلة محددة لربط التشخيص بسجلها"
      />
      <DiseaseDetector />

      <div className="mt-8">
        <h2 className="mb-3 font-bold">آخر التشخيصات المسجلة</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد تشخيصات بعد</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {r.diseaseName}
                    {r.palm && (
                      <Link href={`/palms/${r.palmId}`} className="mr-2 text-xs text-[var(--primary)] underline">
                        {r.palm.code}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")}</div>
                </div>
                <Badge>{DIAGNOSIS_STATUS_LABELS[r.status as DiagnosisStatus] ?? r.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
