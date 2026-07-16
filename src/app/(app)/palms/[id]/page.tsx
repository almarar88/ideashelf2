import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PalmProfileClient } from "@/components/PalmProfileClient";

export default async function PalmProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const palm = await prisma.palm.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { createdAt: "desc" } },
      diagnoses: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!palm) notFound();

  const serialized = {
    ...palm,
    plantingDate: palm.plantingDate?.toISOString() ?? null,
    photos: palm.photos.map((p) => ({ ...p, takenAt: p.takenAt.toISOString() })),
    diagnoses: palm.diagnoses.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
  };

  return <PalmProfileClient palm={serialized} />;
}
