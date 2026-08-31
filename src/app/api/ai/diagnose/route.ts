import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diagnosePalmImage } from "@/lib/ai-diagnosis";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { palmId, photoId, imageBase64, notes } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: "الصورة مطلوبة" }, { status: 400 });
  }

  const result = await diagnosePalmImage(imageBase64, notes);

  let saved = null;
  if (palmId) {
    saved = await prisma.diagnosisReport.create({
      data: {
        palmId,
        photoId: photoId ?? null,
        diseaseName: result.diseaseName,
        confidence: result.confidence,
        severity: result.severity,
        symptoms: result.symptoms,
        treatment: result.treatment,
        prevention: result.prevention,
        aiRaw: result.aiRaw,
        status: result.diseaseName.includes("سليمة") ? "TREATED" : "OPEN",
      },
    });

    if (!result.diseaseName.includes("سليمة")) {
      await prisma.palm.update({
        where: { id: palmId },
        data: { status: "SICK" },
      });
    }
  }

  return NextResponse.json({ result, report: saved, source: result.source });
}
