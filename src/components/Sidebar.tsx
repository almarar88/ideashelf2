"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "📊" },
  { href: "/farm", label: "خريطة المزرعة", icon: "🗺️" },
  { href: "/palms", label: "النخيل", icon: "🌴" },
  { href: "/disease-detection", label: "كشف الأمراض بالذكاء الاصطناعي", icon: "🤖" },
  { href: "/workers", label: "العمال", icon: "👷" },
  { href: "/expenses", label: "المصاريف", icon: "💰" },
  { href: "/calendar", label: "التقويم", icon: "📅" },
  { href: "/market", label: "السوق (بيع وشراء)", icon: "🛒" },
  { href: "/auctions", label: "المزادات", icon: "🔨" },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="text-2xl">🌴</span>
        <div>
          <div className="font-bold leading-tight">نخيلي</div>
          <div className="text-xs text-gray-500 leading-tight">إدارة المزرعة</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-gray-600 hover:bg-[var(--surface-muted)] dark:text-gray-300"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="mb-2 truncate px-2 text-xs text-gray-500">{userName}</div>
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-right text-sm text-gray-600 hover:bg-[var(--surface-muted)] dark:text-gray-300"
        >
          🚪 تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const top = NAV_ITEMS.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
      {top.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-[var(--primary)]" : "text-gray-500"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
