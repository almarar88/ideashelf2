import { NextRequest, NextResponse } from "next/server";
import { pulseToContext, readFarmPulse } from "@/lib/nova/bridge";
import { neuralAvailable, neuralPlan } from "@/lib/nova/cortex";

/**
 * ترجمة نية → خطة نداءات، عبر Claude.
 * لا تعرف هذه الوظيفة شيئًا عن حالة النظام إلا ملخصًا نصيًا يرسله العميل:
 * الحالة الكاملة تبقى في المتصفح، وطبقة الانعكاس المحلية تعمل هناك أيضًا
 * حتى لو سقطت هذه الوظيفة أو غاب المفتاح.
 */
export async function POST(req: NextRequest) {
  if (!neuralAvailable()) {
    return NextResponse.json({ available: false, reason: "no-key" }, { status: 200 });
  }

  let body: { intent?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const intent = typeof body.intent === "string" ? body.intent.slice(0, 1200).trim() : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 4000) : "";
  if (!intent) return NextResponse.json({ error: "النية مطلوبة" }, { status: 400 });

  // نبضة المزرعة تُضاف إلى السياق: هكذا يجيب المُخطِّط عن أرقامك الفعلية
  // بدل أن يخمّن، ويعرف متى يفتح لوحة المزرعة بدل أن يشرحها.
  const pulse = await readFarmPulse();
  const fullContext = `${context}\n\n— بيانات المزرعة الحقيقية —\n${pulseToContext(pulse)}`;

  const result = await neuralPlan(intent, fullContext);
  if (!result) {
    return NextResponse.json({ available: false, reason: "cortex-failed" }, { status: 200 });
  }

  return NextResponse.json({ available: true, plan: result.plan, rejected: result.rejected });
}
