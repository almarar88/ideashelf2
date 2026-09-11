export type AppDef = {
  key: string;
  name: string;
  icon: string;
  hint: string;
  w: number;
  h: number;
  /** كلمات تدل على هذا التطبيق — تستخدمها طبقة الانعكاس المحلية */
  keywords: string[];
};

export const APPS: AppDef[] = [
  {
    key: "oracle",
    name: "الأوراكل",
    icon: "◈",
    hint: "حوار يقود النظام كله",
    w: 560,
    h: 520,
    keywords: ["اوراكل", "أوراكل", "محادثة", "مساعد", "شات", "oracle", "chat", "assistant"],
  },
  {
    key: "calc",
    name: "الحاسبة",
    icon: "＝",
    hint: "حساب ودفتر شريط",
    w: 320,
    h: 460,
    keywords: ["حاسبه", "حاسبة", "احسب", "حساب", "calc", "calculator"],
  },
  {
    key: "clock",
    name: "الساعة",
    icon: "◷",
    hint: "توقيت ومؤقّت ومنبّه",
    w: 380,
    h: 440,
    keywords: ["ساعه", "ساعة", "وقت", "مؤقت", "منبه", "clock", "timer", "alarm"],
  },
  {
    key: "paint",
    name: "الرسّام",
    icon: "✎",
    hint: "ارسم واحفظ صورة حقيقية",
    w: 640,
    h: 520,
    keywords: ["رسام", "رسّام", "ارسم", "رسم", "paint", "draw", "canvas"],
  },
  {
    key: "about",
    name: "عن النظام",
    icon: "ⓘ",
    hint: "حالة النواة والتخزين والقدرات",
    w: 600,
    h: 520,
    keywords: ["عن النظام", "معلومات", "حاله النظام", "about", "system", "info"],
  },
  {
    key: "files",
    name: "المحتوى",
    icon: "▤",
    hint: "ملفات بالمعنى لا بالمجلدات",
    w: 720,
    h: 500,
    keywords: ["ملفات", "المحتوى", "مستندات", "files", "documents"],
  },
  {
    key: "shell",
    name: "الصدفة",
    icon: "⌗",
    hint: "أوامر ولغة طبيعية في سطر واحد",
    w: 640,
    h: 420,
    keywords: ["صدفة", "طرفية", "تيرمنال", "terminal", "shell", "console"],
  },
  {
    key: "notes",
    name: "الكتابة",
    icon: "✎",
    hint: "محرّر يفكّر معك",
    w: 640,
    h: 520,
    keywords: ["ملاحظات", "كتابة", "محرر", "notes", "editor", "write"],
  },
  {
    key: "studio",
    name: "المشغل",
    icon: "✦",
    hint: "صف تطبيقًا فيولد أمامك",
    w: 700,
    h: 560,
    keywords: ["مشغل", "استوديو", "توليد", "اصنع", "studio", "generate", "builder"],
  },
  {
    key: "monitor",
    name: "المراقب",
    icon: "◎",
    hint: "الوكلاء والنداءات لحظة بلحظة",
    w: 680,
    h: 480,
    keywords: ["مراقب", "مهام", "عمليات", "monitor", "tasks", "processes"],
  },
  {
    key: "timeline",
    name: "الخط الزمني",
    icon: "↺",
    hint: "ارجع بالنظام إلى أي لحظة",
    w: 620,
    h: 460,
    keywords: ["زمن", "تاريخ", "ارجاع", "سجل", "timeline", "history", "undo"],
  },
  {
    key: "rules",
    name: "القواعد",
    icon: "⟐",
    hint: "متى يحدث كذا… افعل كذا",
    w: 600,
    h: 440,
    keywords: ["قواعد", "اتمتة", "أتمتة", "rules", "automation"],
  },
  {
    key: "guard",
    name: "الصلاحيات",
    icon: "⛨",
    hint: "من يملك ماذا في نظامك",
    w: 640,
    h: 520,
    keywords: ["صلاحيات", "الصلاحيات", "امان", "أمان", "حمايه", "حماية", "permissions", "security", "guard"],
  },
  {
    key: "settings",
    name: "الهوية",
    icon: "⚙",
    hint: "شكل النظام وطبقة ذكائه",
    w: 620,
    h: 500,
    keywords: ["اعدادات", "إعدادات", "هوية", "مظهر", "settings", "theme", "preferences"],
  },
];

export const APP_MAP: Record<string, AppDef> = Object.fromEntries(APPS.map((a) => [a.key, a]));

export function appManual(): string {
  return APPS.map((a) => `- ${a.key}: ${a.name} — ${a.hint}`).join("\n");
}
