import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نخيلي | إدارة المزرعة",
  description: "منصة متكاملة لإدارة مزارع النخيل: النخيل، العمال، المصاريف، الخريطة، الذكاء الاصطناعي، السوق والمزادات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-arabic">
        {children}
      </body>
    </html>
  );
}
