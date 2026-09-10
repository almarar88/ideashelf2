import type { Metadata } from "next";
import "./nova.css";

export const metadata: Metadata = {
  title: "NOVA OS · نظام تشغيل بالنيّة",
  description:
    "نظام تشغيل تُقاد كل حالته بالذكاء الاصطناعي: نية واحدة تتحوّل إلى نداءات نظام مُسجّلة وقابلة للإرجاع الزمني.",
};

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
