/**
 * مدخل نسخة الجهاز (APK).
 *
 * نوفا على الويب تُقدّمها Next.js: صفحة خادم تقرأ الجلسة والبيئة ثم تُحمّل
 * النظام. داخل التطبيق لا يوجد خادم إطلاقًا — لا Node، ولا قاعدة بيانات،
 * ولا مفتاح. لذلك هذا المدخل يُركّب النواة مباشرة في المتصفح المُضمَّن.
 *
 * ولأن كل شيء في نوفا مبنيّ على أن الذكاء السحابي *يوسّعها ولا يشترطها*،
 * فهذه النسخة ليست عرضًا مبتورًا: النوافذ والأسطح والملفات والصلاحيات
 * وتوليد التطبيقات والوكلاء والأتمتة والإرجاع الزمني تعمل كلها هنا،
 * بطبقة الانعكاس المحلية الحتمية. وما يحتاج خادمًا يُعلن غيابه صراحةً.
 */

import { createRoot } from "react-dom/client";
import NovaOS from "../../src/components/nova/NovaOS";
import "../../src/app/os/nova.css";

/** الجسر الذي تنادي عليه قشرة أندرويد عند زرّ الرجوع */
declare global {
  interface Window {
    __novaBack?: () => void;
  }
}

window.__novaBack = () => window.dispatchEvent(new Event("nova:back"));

const host = document.getElementById("nova-root");
if (host) {
  createRoot(host).render(
    <NovaOS
      neural={false}
      model="reflex/1.0"
      identity={{ name: "صاحب الجهاز", handle: "device@nova", role: "OWNER" }}
      edition="device"
    />
  );
}
