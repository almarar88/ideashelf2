import { connection } from "next/server";
import NovaClient from "@/components/nova/NovaClient";
import { getSession } from "@/lib/auth";
import { MODEL, neuralAvailable } from "@/lib/nova/cortex";

/**
 * نقطة إقلاع نوفا.
 * الخادم يمرّر حقيقتين فقط: هل طبقة العصب متاحة، ومن المستخدم الجالس أمام
 * النظام (من جلسة التطبيق نفسها). المفتاح لا يعبر إلى المتصفح بأي شكل.
 * ننتظر الطلب قبل قراءة البيئة والجلسة حتى يكون ذلك في وقت التشغيل لا البناء.
 */
export default async function OsPage() {
  await connection();
  const session = await getSession();
  return (
    <NovaClient
      neural={neuralAvailable()}
      model={MODEL}
      identity={
        session
          ? { name: session.name, handle: session.email, role: session.role }
          : { name: "زائر", handle: "guest@nova", role: "VIEWER" }
      }
    />
  );
}
