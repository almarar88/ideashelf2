import { NextRequest, NextResponse } from "next/server";
import { neuralCompose } from "@/lib/nova/cortex";
import { fallbackSpec } from "@/lib/nova/spec";

/** توليد تطبيق كامل من وصف — يعيد مواصفة واجهة مُتحقّق منها دائمًا */
export async function POST(req: NextRequest) {
  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 400).trim() : "";
  if (!prompt) return NextResponse.json({ error: "الوصف مطلوب" }, { status: 400 });

  try {
    const { spec, source } = await neuralCompose(prompt);
    return NextResponse.json({ spec, source });
  } catch {
    return NextResponse.json({ spec: fallbackSpec(prompt), source: "reflex" });
  }
}
