import { connection } from "next/server";
import NovaClient from "@/components/nova/NovaClient";
import { MODEL, neuralAvailable } from "@/lib/nova/cortex";

/**
 * نقطة إقلاع نوفا.
 * الخادم لا يمرّر إلا حقيقة واحدة: هل طبقة العصب متاحة؟ والمفتاح نفسه لا يعبر
 * إلى المتصفح بأي شكل. ننتظر الطلب قبل قراءة البيئة حتى تُقرأ في وقت التشغيل
 * لا وقت البناء — إضافة المفتاح تُفعّل العصب بلا إعادة بناء.
 */
export default async function OsPage() {
  await connection();
  return <NovaClient neural={neuralAvailable()} model={MODEL} />;
}
