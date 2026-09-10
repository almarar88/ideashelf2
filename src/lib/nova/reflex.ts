import { APPS } from "./apps";
import type { NovaState, Plan, SyscallCall } from "./types";

/**
 * طبقة الانعكاس (Reflex)
 *
 * مُخطِّط محلي حتمي: لا شبكة، لا مفتاح، لا كلفة. يفهم صيغًا شائعة
 * بالعربية والإنجليزية ويترجمها إلى نداءات نظام.
 * وجودها قرار معماري: نوفا يجب أن تعمل كاملة حتى لو انقطع الذكاء السحابي —
 * الذكاء يوسّع النظام ولا يشترطه.
 */

const COLORS: Record<string, string> = {
  بنفسجي: "#7c5cff",
  ارجواني: "#a855f7",
  أرجواني: "#a855f7",
  ازرق: "#3b82f6",
  أزرق: "#3b82f6",
  سماوي: "#22d3ee",
  تركوازي: "#14b8a6",
  اخضر: "#22c55e",
  أخضر: "#22c55e",
  ذهبي: "#eab308",
  اصفر: "#facc15",
  أصفر: "#facc15",
  برتقالي: "#f97316",
  احمر: "#ef4444",
  أحمر: "#ef4444",
  وردي: "#ec4899",
  زهري: "#ec4899",
  رمادي: "#94a3b8",
  ابيض: "#e2e8f0",
  أبيض: "#e2e8f0",
  purple: "#7c5cff",
  blue: "#3b82f6",
  cyan: "#22d3ee",
  green: "#22c55e",
  gold: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
};

const WALLS: Record<string, string> = {
  شفق: "aurora",
  اورورا: "aurora",
  كثبان: "dune",
  صحراء: "dune",
  عمق: "abyss",
  ابيس: "abyss",
  حرير: "silk",
  شبكة: "grid",
  اورجانك: "silk",
  aurora: "aurora",
  dune: "dune",
  abyss: "abyss",
  silk: "silk",
  grid: "grid",
};

/** تطبيع عربي: إزالة التشكيل وتوحيد الألف والياء والهاء */
export function fold(text: string): string {
  return text
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

function has(t: string, ...words: string[]): boolean {
  return words.some((w) => t.includes(fold(w)));
}

function findApp(t: string): string | null {
  for (const app of APPS) {
    if (app.keywords.some((k) => t.includes(fold(k)))) return app.key;
  }
  return null;
}

function quoted(raw: string): string | null {
  const m = raw.match(/[«"'](.+?)[»"']/);
  return m ? m[1].trim() : null;
}

/** بعد كلمة مفتاحية: خذ ما تبقّى من الجملة كموضوع */
function after(raw: string, keys: string[]): string | null {
  const t = fold(raw);
  for (const k of keys) {
    const idx = t.indexOf(fold(k));
    if (idx >= 0) {
      const tail = raw.slice(idx + k.length).replace(/^[\s:،,\-–]+/, "").trim();
      if (tail) return tail;
    }
  }
  return null;
}

export function reflexPlan(intent: string, state: NovaState): Plan {
  const started = Date.now();
  const raw = intent.trim();
  const t = fold(raw);
  const calls: SyscallCall[] = [];
  let say = "";

  const done = (): Plan => ({
    say,
    calls,
    source: "reflex",
    latency: Date.now() - started,
  });

  if (!t) {
    say = "اكتب ما تريد… أو جرّب: «رتّب النوافذ شبكة».";
    return done();
  }

  // ── أسئلة عن حالة النظام: يجيب محليًا من الحالة نفسها
  if (has(t, "كم ملف", "عدد الملفات", "how many files")) {
    say = `لديك ${state.fs.length} عنصرًا في المحتوى، وأحدثها «${
      [...state.fs].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.path ?? "—"
    }».`;
    return done();
  }
  if (has(t, "ما المفتوح", "ايش مفتوح", "النوافذ المفتوحه", "what is open")) {
    say = state.windows.length
      ? `مفتوح الآن: ${state.windows.map((w) => w.title).join("، ")}.`
      : "لا نوافذ مفتوحة. سطح المكتب نظيف.";
    return done();
  }
  if (has(t, "من انت", "ما هو نوفا", "who are you", "عرف نفسك")) {
    say =
      "أنا نوفا: نظام تشغيل تُقاد حالته بالنية. كل ما تطلبه يتحوّل إلى نداءات نظام مُسجّلة، ولهذا يمكن إرجاع أي شيء فعلته.";
    return done();
  }

  // ── الطاقة والأوضاع
  if (has(t, "اقفل", "قفل الجلسه", "lock")) {
    calls.push({ op: "power", args: { action: "lock" } });
    say = "أقفلت الجلسة.";
    return done();
  }
  if (has(t, "اعد التشغيل", "ريبوت", "reboot", "restart")) {
    calls.push({ op: "power", args: { action: "reboot" } });
    say = "إعادة تشغيل النواة.";
    return done();
  }
  if (has(t, "وضع التركيز", "زين", "focus mode", "zen")) {
    calls.push({ op: "power", args: { action: "zen" } });
    say = "وضع التركيز: أبقيت النافذة النشطة فقط.";
    return done();
  }

  // ── الإرجاع الزمني
  if (has(t, "ارجع بالزمن", "تراجع", "الغ اخر", "undo", "rewind")) {
    const seq = Math.max(0, state.seq - 1);
    calls.push({ op: "journal.rewind", args: { seq } });
    say = `أرجعت النظام إلى النقطة ${seq}.`;
    return done();
  }

  // ── الهوية البصرية
  if (has(t, "ليلي", "مظلم", "غامق", "dark", "night")) {
    calls.push({ op: "theme.set", args: { mode: "night" } });
    say = "الوضع الليلي.";
  }
  if (has(t, "نهاري", "فاتح", "مضيء", "light", "dawn")) {
    calls.push({ op: "theme.set", args: { mode: "dawn" } });
    say = "وضع الفجر.";
  }
  for (const [word, hex] of Object.entries(COLORS)) {
    if (t.includes(fold(word))) {
      calls.push({ op: "theme.set", args: { accent: hex } });
      say = `لون التمييز الآن ${word}.`;
      break;
    }
  }
  for (const [word, wall] of Object.entries(WALLS)) {
    if (has(t, "خلفيه", "خلفية", "wallpaper", "background") && t.includes(fold(word))) {
      calls.push({ op: "theme.set", args: { wallpaper: wall } });
      say = "غيّرت الخلفية.";
      break;
    }
  }
  if (has(t, "اوقف الحركه", "بدون حركه", "no motion", "reduce motion")) {
    calls.push({ op: "theme.set", args: { motion: false } });
    say = "أطفأت الحركة.";
  }
  if (calls.length) return done();

  // ── ترتيب النوافذ
  if (has(t, "رتب", "نظم", "arrange", "tile")) {
    const mode = has(t, "تتالي", "cascade")
      ? "cascade"
      : has(t, "نصف", "شطر", "split")
      ? "split"
      : has(t, "تركيز", "focus")
      ? "focus"
      : "grid";
    calls.push({ op: "win.arrange", args: { mode } });
    say = "رتّبت سطح المكتب.";
    return done();
  }

  // ── إغلاق وتصغير
  if (has(t, "اغلق", "سكر", "close")) {
    const all = has(t, "كل", "الكل", "everything", "all");
    const app = findApp(t);
    if (all) {
      calls.push({ op: "win.close", args: { all: true } });
      say = "أغلقت كل النوافذ.";
    } else if (app) {
      const win = state.windows.find((w) => w.app === app);
      if (win) {
        calls.push({ op: "win.close", args: { id: win.id } });
        say = "أُغلق.";
      } else {
        say = "هذا التطبيق ليس مفتوحًا.";
      }
    } else {
      calls.push({ op: "win.close", args: {} });
      say = "أغلقت النافذة النشطة.";
    }
    return done();
  }
  if (has(t, "صغر", "اخف", "minimize")) {
    calls.push({ op: "win.minimize", args: { all: has(t, "كل", "الكل", "all") } });
    say = "صغّرت.";
    return done();
  }
  if (has(t, "كبر", "ملء الشاشه", "maximize", "fullscreen")) {
    calls.push({ op: "win.maximize", args: {} });
    say = "كبّرت النافذة.";
    return done();
  }

  // ── توليد تطبيق: أقوى قدرة في النظام، فلتُجرّب قبل «افتح»
  if (has(t, "اصنع", "سو لي", "سوي لي", "ولد", "انشئ تطبيق", "ابن لي", "build me", "make me", "generate app", "create app")) {
    const isApp = has(t, "تطبيق", "اداه", "ادات", "برنامج", "app", "tool", "widget", "لوحه", "dashboard");
    const subject = after(raw, ["تطبيق", "اداة", "أداة", "برنامج", "لوحة", "app", "tool", "dashboard"]) ?? raw;
    if (isApp || !findApp(t)) {
      calls.push({ op: "app.compose", args: { prompt: subject.slice(0, 300) } });
      say = "أكوّن لك التطبيق الآن…";
      return done();
    }
  }

  // ── الوكلاء
  if (has(t, "وكيل", "شغل مهمه", "agent", "spawn")) {
    const goal = after(raw, ["وكيل", "مهمة", "مهمه", "agent", "task"]) ?? raw;
    calls.push({
      op: "agent.spawn",
      args: { name: goal.split(/\s+/).slice(0, 3).join(" ") || "وكيل", goal: goal.slice(0, 180) },
    });
    say = "أطلقت وكيلًا في الخلفية؛ راقبه من «المراقب».";
    return done();
  }

  // ── البحث
  if (has(t, "ابحث", "دور على", "جد", "search", "find")) {
    const q = after(raw, ["ابحث عن", "ابحث", "دور على", "جد", "search for", "search", "find"]) ?? raw;
    calls.push({ op: "fs.search", args: { query: q.slice(0, 100) } });
    say = `نتائج «${q}».`;
    return done();
  }

  // ── الكتابة والحذف
  if (has(t, "احذف", "امسح", "delete", "remove")) {
    const name = quoted(raw) ?? after(raw, ["احذف", "امسح", "delete", "remove"]);
    if (name) {
      const hit = state.fs.find((f) => fold(f.path).includes(fold(name)));
      if (hit) {
        calls.push({ op: "fs.delete", args: { path: hit.path } });
        say = `حذفت ${hit.path}.`;
      } else say = "لم أجد هذا المسار.";
    } else say = "أي ملف أحذف؟";
    return done();
  }
  if (has(t, "اكتب", "انشئ ملف", "ملف جديد", "دون", "سجل", "note", "write", "new file")) {
    const name = quoted(raw) ?? after(raw, ["ملف", "اسمه", "بعنوان", "file", "named"]) ?? "ملاحظة";
    const clean = name.replace(/[\\:*?"<>|]/g, "").slice(0, 60) || "ملاحظة";
    const path = clean.includes("/") ? clean : `/بيتي/${clean}${/\.\w+$/.test(clean) ? "" : ".md"}`;
    calls.push({
      op: "fs.write",
      args: { path, content: `# ${clean}\n\nنشأ من النية: ${raw}\n`, tags: ["نية", "جديد"], open: true },
    });
    say = `أنشأت ${clean} وفتحته للتحرير.`;
    return done();
  }

  // ── تذكير/إشعار
  if (has(t, "ذكرني", "نبهني", "remind", "notify")) {
    const what = after(raw, ["ذكرني", "نبهني", "remind me", "notify"]) ?? raw;
    calls.push({ op: "notify", args: { title: "تذكير", body: what.slice(0, 200), level: "warn" } });
    say = "سجّلت التذكير في مركز الإشعارات.";
    return done();
  }

  // ── فتح تطبيق (بعد استنفاد النوايا الأكثر تحديدًا)
  const app = findApp(t);
  if (app) {
    calls.push({ op: "win.open", args: { app } });
    say = `فتحت ${APPS.find((a) => a.key === app)?.name}.`;
    return done();
  }
  const made = state.composed.find((c) => fold(c.name).includes(t) || t.includes(fold(c.name)));
  if (made) {
    calls.push({ op: "win.open", args: { app: made.id } });
    say = `فتحت ${made.name}.`;
    return done();
  }

  // ── لا نية واضحة: افتح الأوراكل بالسؤال بدل رمي رسالة خطأ
  calls.push({ op: "say", args: { text: `لم أتعرّف على نية دقيقة في «${raw}».` } });
  calls.push({ op: "win.open", args: { app: "oracle" } });
  say =
    "طبقة الانعكاس المحلية لم تفهم الطلب بدقة. مع مفتاح ANTHROPIC_API_KEY تتولى طبقة العصب (Claude) التخطيط الحر. جرّب: «اصنع تطبيق…»، «رتّب شبكة»، «ابحث عن مزرعة».";
  return done();
}
