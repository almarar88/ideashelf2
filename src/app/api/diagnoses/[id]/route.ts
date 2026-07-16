import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const report = await prisma.diagnosisReport.update({
    where: { id },
    data: { status: body.status },
  });
  return NextResponse.json(report);
}
