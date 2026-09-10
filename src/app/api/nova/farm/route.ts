import { NextResponse } from "next/server";
import { readFarmPulse } from "@/lib/nova/bridge";

/** نبضة المزرعة الحقيقية — قراءة فقط، محميّة بجلسة التطبيق نفسها */
export async function GET() {
  const pulse = await readFarmPulse();
  return NextResponse.json(pulse, { headers: { "Cache-Control": "no-store" } });
}
