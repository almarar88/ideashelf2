import { connection } from "next/server";
import NovaClient from "@/components/nova/NovaClient";
import { getSession } from "@/lib/auth";
import { MODEL, neuralAvailable } from "@/lib/nova/cortex";

/**
 * نقطة إقلاع نوفا.
 *
 * الخادم يمرّر حقيقتين فقط: هل طبقة العصب متاحة، ومن الجالس أمام النظام.
 * المفتاح لا يعبر إلى المتصفح بأي شكل. وننتظر الطلب قبل قراءة البيئة
 * والجلسة حتى تُقرأا في وقت التشغيل لا وقت البناء.
 *
 * الصفحة مفتوحة بلا تسجيل دخول: نوفا نظام عام تعيش حالته في متصفحك، ولا
 * يقرأ شيئًا من الخادم. ما يحتاج حسابًا هو طبقة العصب وحدها (تصرف مفتاحًا).
 */
export default async function OsPage() {
  await connection();
  const session = await getSession();
  return (
    <NovaClient
      neural={neuralAvailable()}
      model={MODEL}
      identity={
        // جلسة التطبيق إن وُجدت — وإلا فأنت صاحب الجهاز. نوفا لا تشترط حسابًا.
        session
          ? { name: session.name, handle: session.email, role: session.role }
          : { name: "صاحب الجهاز", handle: "local@nova", role: "OWNER" }
      }
    />
  );
}
