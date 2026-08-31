import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkerProfileClient } from "@/components/WorkerProfileClient";

export default async function WorkerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = await prisma.worker.findUnique({
    where: { id },
    include: { salaryPayments: { orderBy: { dueDate: "desc" } } },
  });
  if (!worker) notFound();

  const serialized = {
    ...worker,
    hireDate: worker.hireDate?.toISOString() ?? null,
    salaryPayments: worker.salaryPayments.map((p) => ({
      ...p,
      dueDate: p.dueDate.toISOString(),
      paidDate: p.paidDate?.toISOString() ?? null,
    })),
  };

  return <WorkerProfileClient worker={serialized} />;
}
