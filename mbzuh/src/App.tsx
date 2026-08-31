import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { useUi } from "./components/ui";
import type { SearchHit } from "@shared/types";
import DashboardPage from "./pages/Dashboard";
import TrainersPage from "./pages/Trainers";
import CoursesPage from "./pages/Courses";
import SchedulePage from "./pages/Schedule";
import RoomsPage from "./pages/Rooms";
import PartnersPage from "./pages/Partners";
import StudentsPage from "./pages/Students";
import ReportsPage from "./pages/Reports";
import MinutesPage from "./pages/Minutes";
import SettingsPage from "./pages/Settings";

export type PageId =
  | "dashboard" | "trainers" | "courses" | "schedule" | "rooms"
  | "partners" | "students" | "reports" | "minutes" | "settings";

export interface NavPayload {
  page: PageId;
  focusId?: number;
  query?: string;
}

const MODULES: { title: string; items: { id: PageId; label: string; icon: string }[] }[] = [
  {
    title: "نظرة عامة",
    items: [{ id: "dashboard", label: "لوحة المؤشرات", icon: "◎" }],
  },
  {
    title: "١ · الدورات والمدربون",
    items: [
      { id: "trainers", label: "سجل المدربين", icon: "❖" },
      { id: "courses", label: "منسق المستويات", icon: "▤" },
      { id: "schedule", label: "الجدول وكاشف التعارض", icon: "⧉" },
    ],
  },
  {
    title: "٢ · اللوجستيات والشركاء",
    items: [
      { id: "partners", label: "سجل الشركاء", icon: "◈" },
      { id: "rooms", label: "القاعات والمرافق", icon: "▣" },
    ],
  },
  {
    title: "٣ · التقارير والإحصائيات",
    items: [
      { id: "students", label: "الطلبة والحضور", icon: "☰" },
      { id: "reports", label: "مولّد التقارير", icon: "⌸" },
    ],
  },
  {
    title: "٤ · المحاضر والمناهج",
    items: [{ id: "minutes", label: "أرشيف المحاضر", icon: "✎" }],
  },
  {
    title: "النظام",
    items: [{ id: "settings", label: "الإعدادات والنسخ", icon: "⚙" }],
  },
];

const ENTITY_PAGE: Record<SearchHit["entity"], PageId> = {
  trainer: "trainers",
  course: "courses",
  minute: "minutes",
  partner: "partners",
  student: "students",
  room: "rooms",
};

const ENTITY_LABEL: Record<SearchHit["entity"], string> = {
  trainer: "مدرب",
  course: "دورة",
  minute: "محضر",
  partner: "جهة",
  student: "طالب",
  room: "قاعة",
};

export default function App() {
  const { toast } = useUi();
  const [nav, setNav] = useState<NavPayload>({ page: "dashboard" });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [orgName, setOrgName] = useState("الإدارة الأكاديمية");
  const [conflictCount, setConflictCount] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = useCallback((page: PageId, focusId?: number, q?: string) => {
    setNav({ page, focusId, query: q });
    setPaletteOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const refreshChrome = useCallback(async () => {
    try {
      const [settings, conflicts] = await Promise.all([api.settings.all(), api.conflicts.all()]);
      if (settings.theme === "light" || settings.theme === "dark") setTheme(settings.theme);
      if (settings.org_name) setOrgName(settings.org_name);
      setConflictCount(conflicts.filter((c) => c.severity === "error").length);
    } catch {
      /* أول تشغيل قد يسبق تهيئة القاعدة */
    }
  }, []);

  useEffect(() => {
    void refreshChrome();
    const timer = window.setInterval(() => void refreshChrome(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshChrome]);

  useEffect(() => {
    const offNav = window.dynamo.on("app:navigate", (page) => go(page as PageId));
    const offCmd = window.dynamo.on("app:command", async (cmd) => {
      if (cmd === "search") setPaletteOpen(true);
      if (cmd === "backup") {
        const info = await api.backup.create();
        toast(`تم إنشاء نسخة احتياطية (${Math.round(info.size / 1024)} ك.ب)`, "ok");
      }
    });
    return () => {
      offNav();
      offCmd();
    };
  }, [go, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setHits([]);
      setCursor(0);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = window.setTimeout(async () => {
      if (query.trim().length < 1) {
        setHits([]);
        return;
      }
      setHits(await api.search.global(query.trim()));
      setCursor(0);
    }, 140);
    return () => window.clearTimeout(t);
  }, [query, paletteOpen]);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    await api.settings.set("theme", next);
  };

  const page = useMemo(() => {
    switch (nav.page) {
      case "trainers":
        return <TrainersPage focusId={nav.focusId} onNavigate={go} />;
      case "courses":
        return <CoursesPage focusId={nav.focusId} onNavigate={go} />;
      case "schedule":
        return <SchedulePage onNavigate={go} />;
      case "rooms":
        return <RoomsPage focusId={nav.focusId} />;
      case "partners":
        return <PartnersPage focusId={nav.focusId} />;
      case "students":
        return <StudentsPage focusId={nav.focusId} />;
      case "reports":
        return <ReportsPage />;
      case "minutes":
        return <MinutesPage focusId={nav.focusId} trainerId={nav.query ? Number(nav.query) : undefined} />;
      case "settings":
        return <SettingsPage onThemeChange={setTheme} onOrgChange={setOrgName} />;
      default:
        return <DashboardPage onNavigate={go} />;
    }
  }, [nav, go]);

  return (
    <div className="h-full flex" style={{ background: "var(--bg)" }}>
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{ background: "var(--panel)", borderInlineEnd: "1px solid var(--border)" }}
      >
        <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center font-black"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              د
            </div>
            <div className="min-w-0">
              <div className="font-bold leading-tight">الدينامو</div>
              <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                {orgName}
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm w-full mt-3 justify-between"
            onClick={() => setPaletteOpen(true)}
            style={{ color: "var(--muted)" }}
          >
            <span>بحث فوري…</span>
            <span className="text-[11px] opacity-70">Ctrl K</span>
          </button>
        </div>

        <nav className="flex-1 scroll-y px-2 py-3">
          {MODULES.map((group) => (
            <div key={group.title} className="mb-3">
              <div className="px-2 mb-1 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                {group.title}
              </div>
              {group.items.map((item) => {
                const on = nav.page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm mb-0.5"
                    style={{
                      background: on ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                      color: on ? "var(--accent)" : "var(--ink-2)",
                      fontWeight: on ? 700 : 500,
                      cursor: "pointer",
                      border: "none",
                      textAlign: "start",
                    }}
                  >
                    <span style={{ opacity: 0.85 }}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.id === "schedule" && conflictCount > 0 && (
                      <span
                        className="text-[11px] px-1.5 rounded-full"
                        style={{ background: "var(--danger)", color: "#fff" }}
                      >
                        {conflictCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-sm w-full" onClick={toggleTheme}>
            {theme === "dark" ? "☀ الوضع الفاتح" : "☾ الوضع الداكن"}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 scroll-y">
        <div className="p-6 max-w-[1500px] mx-auto">{page}</div>
      </main>

      {paletteOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="panel rise w-full" style={{ maxWidth: 640, boxShadow: "var(--shadow)" }}>
            <input
              ref={inputRef}
              className="input"
              style={{ border: "none", borderBottom: "1px solid var(--border)", borderRadius: "14px 14px 0 0", padding: "14px 16px" }}
              placeholder="ابحث في المدربين، الدورات، المحاضر، الشركاء، الطلبة…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, hits.length - 1));
                if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
                if (e.key === "Enter" && hits[cursor]) {
                  const hit = hits[cursor];
                  go(ENTITY_PAGE[hit.entity], hit.id);
                }
              }}
            />
            <div className="scroll-y" style={{ maxHeight: 420 }}>
              {hits.length === 0 ? (
                <p className="p-6 text-center text-sm" style={{ color: "var(--muted)" }}>
                  {query ? "لا توجد نتائج مطابقة." : "اكتب كلمة للبحث في كل وحدات النظام."}
                </p>
              ) : (
                hits.map((hit, i) => (
                  <button
                    key={`${hit.entity}-${hit.id}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(ENTITY_PAGE[hit.entity], hit.id)}
                    className="w-full text-start px-4 py-2.5 flex items-start gap-3"
                    style={{
                      background: i === cursor ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    }}
                  >
                    <span className="badge badge-accent mt-0.5">{ENTITY_LABEL[hit.entity]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-sm truncate" style={{ color: "var(--ink)" }}>
                        {hit.title}
                      </span>
                      <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>
                        {hit.subtitle}
                        {hit.snippet ? ` — ${hit.snippet}` : ""}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
