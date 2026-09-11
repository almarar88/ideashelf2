import type { Metadata, Viewport } from "next";
import "./nova.css";

export const metadata: Metadata = {
  title: "NOVA OS · نظام تشغيل بالنيّة",
  description:
    "نظام تشغيل تُقاد كل حالته بالذكاء الاصطناعي: نية واحدة تتحوّل إلى نداءات نظام مُسجّلة، بصلاحيات صريحة وإرجاع زمني حقيقي.",
  manifest: "/manifest.webmanifest",
  applicationName: "NOVA",
  appleWebApp: { capable: true, title: "NOVA", statusBarStyle: "black-translucent" },
  icons: { icon: "/nova-icon.svg", apple: "/nova-icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#07070d",
  width: "device-width",
  initialScale: 1,
  // النظام يملأ الشاشة على الأجهزة ذات الحواف المنحنية
  viewportFit: "cover",
  userScalable: false,
};

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
