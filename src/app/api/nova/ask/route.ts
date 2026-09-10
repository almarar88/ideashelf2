import { NextRequest, NextResponse } from "next/server";
import { neuralAsk, neuralAvailable } from "@/lib/nova/cortex";

/** سؤال حر لطبقة العصب — يستخدمه الأوراكل والمحرّر */
export async function POST(req: NextRequest) {
  if (!neuralAvailable()) {
    return NextResponse.json({ available: false }, { status: 200 });
  }

  let body: { question?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.slice(0, 6000).trim() : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 12000) : "";
  if (!question) return NextResponse.json({ error: "السؤال مطلوب" }, { status: 400 });

  const answer = await neuralAsk(question, context);
  if (!answer) return NextResponse.json({ available: false }, { status: 200 });
  return NextResponse.json({ available: true, answer });
}
