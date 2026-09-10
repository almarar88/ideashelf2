import { z } from "zod";
import type { SyscallCall } from "./types";

/**
 * جدول نداءات النظام (Syscall Table)
 *
 * هذا الملف هو المصدر الوحيد للحقيقة في نوفا:
 *  - النواة تنفّذ ما هو معرّف هنا فقط.
 *  - طبقة الذكاء (Cortex) تتعلّم القدرات من نفس الجدول.
 *  - أي نداء لا يطابق مخططه يُرفض قبل أن يلمس الحالة.
 * إضافة قدرة جديدة للنظام = إضافة سطر هنا + فرع في النواة. لا شيء آخر.
 */

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "لون غير صالح");

const path = z.string().min(1).max(160);

export const SYSCALLS = {
  "win.open": {
    title: "افتح تطبيقًا",
    doc: "يفتح نافذة تطبيق. app واحد من مفاتيح التطبيقات، أو معرّف تطبيق مولّد.",
    schema: z.object({
      app: z.string().min(1),
      title: z.string().max(80).optional(),
      props: z.record(z.string(), z.unknown()).optional(),
    }),
  },
  "win.close": {
    title: "أغلق نافذة",
    doc: "يغلق نافذة بمعرّفها، أو النافذة النشطة إن لم يُحدد، أو الكل عند all=true.",
    schema: z.object({ id: z.string().optional(), all: z.boolean().optional() }),
  },
  "win.focus": {
    title: "ركّز نافذة",
    doc: "يرفع نافذة إلى الأمام ويلغي تصغيرها.",
    schema: z.object({ id: z.string() }),
  },
  "win.minimize": {
    title: "صغّر نافذة",
    doc: "يصغّر نافذة إلى الشريط. بدون معرّف يصغّر النشطة.",
    schema: z.object({ id: z.string().optional(), all: z.boolean().optional() }),
  },
  "win.maximize": {
    title: "كبّر نافذة",
    doc: "يبدّل تكبير النافذة لملء سطح المكتب.",
    schema: z.object({ id: z.string().optional() }),
  },
  "win.move": {
    title: "حرّك/حجّم نافذة",
    doc: "يضبط موضع وحجم نافذة بالبكسل.",
    schema: z.object({
      id: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      w: z.number().min(280).optional(),
      h: z.number().min(180).optional(),
    }),
  },
  "win.arrange": {
    title: "رتّب النوافذ",
    doc: "يعيد ترتيب كل النوافذ المفتوحة: grid شبكة، cascade تتالي، split نصفين، focus تركيز على النشطة.",
    schema: z.object({
      mode: z.enum(["grid", "cascade", "split", "focus"]),
      /** أبعاد سطح المكتب الحقيقية — تُحقنها الواجهة، ويُسجّلها السجل ليصحّ الإرجاع الزمني */
      vw: z.number().min(320).optional(),
      vh: z.number().min(240).optional(),
    }),
  },
  "fs.write": {
    title: "اكتب ملفًا",
    doc: "ينشئ أو يحدّث ملفًا في نظام الملفات الدلالي. tags وسوم للبحث بالمعنى.",
    schema: z.object({
      path,
      content: z.string().max(20000).default(""),
      tags: z.array(z.string().max(24)).max(12).optional(),
      open: z.boolean().optional(),
    }),
  },
  "fs.delete": {
    title: "احذف ملفًا",
    doc: "يحذف ملفًا أو مجلدًا بالمسار.",
    schema: z.object({ path }),
  },
  "fs.search": {
    title: "ابحث دلاليًا",
    doc: "يبحث في الأسماء والوسوم والمحتوى ويفتح نافذة نتائج.",
    schema: z.object({ query: z.string().min(1).max(120) }),
  },
  "farm.pulse": {
    title: "أبصر المزرعة",
    doc: "يفتح لوحة نبضة المزرعة الحقيقية (نخيل، عمال، مصاريف، مزادات) من قاعدة بيانات التطبيق.",
    schema: z.object({ focus: z.enum(["all", "palms", "money", "workers", "market"]).optional() }),
  },
  "farm.report": {
    title: "اكتب تقرير المزرعة",
    doc: "يحوّل نبضة المزرعة الحالية إلى ملف تقرير في المحتوى.",
    schema: z.object({ path: z.string().max(160).optional() }),
  },
  "nav.open": {
    title: "افتح شاشة في التطبيق",
    doc: "يفتح شاشة من تطبيق المزرعة في تبويب جديد. route واحد من: /dashboard, /farm, /palms, /workers, /expenses, /calendar, /market, /auctions, /disease-detection.",
    schema: z.object({
      route: z.enum([
        "/dashboard",
        "/farm",
        "/palms",
        "/workers",
        "/expenses",
        "/calendar",
        "/market",
        "/auctions",
        "/disease-detection",
      ]),
    }),
  },
  "theme.set": {
    title: "غيّر الهوية البصرية",
    doc: "يضبط الوضع (night/dawn)، لون التمييز بصيغة hex، الخلفية، الحركة، وشفافية الزجاج 0-1.",
    schema: z.object({
      mode: z.enum(["night", "dawn"]).optional(),
      accent: hexColor.optional(),
      wallpaper: z.enum(["aurora", "dune", "abyss", "silk", "grid"]).optional(),
      motion: z.boolean().optional(),
      glass: z.number().min(0).max(1).optional(),
    }),
  },
  notify: {
    title: "أشعر المستخدم",
    doc: "يرسل إشعارًا إلى مركز الإشعارات.",
    schema: z.object({
      title: z.string().max(90),
      body: z.string().max(240).optional(),
      level: z.enum(["info", "ok", "warn", "error"]).optional(),
    }),
  },
  "agent.spawn": {
    title: "أطلق وكيلًا",
    doc: "يشغّل وكيلًا خلفيًا لهدف طويل، مع خطوات تُنجَز تدريجيًا ويظهر في مراقب النظام.",
    schema: z.object({
      name: z.string().max(48),
      goal: z.string().max(200),
      steps: z.array(z.string().max(80)).max(8).optional(),
    }),
  },
  "agent.kill": {
    title: "أوقف وكيلًا",
    doc: "يوقف وكيلًا يعمل في الخلفية.",
    schema: z.object({ id: z.string() }),
  },
  "app.compose": {
    title: "اصنع تطبيقًا",
    doc: "يولّد تطبيقًا جديدًا بالكامل من وصف بالكلمات ويثبّته في النظام. استخدمه عند طلب أداة غير موجودة.",
    schema: z.object({
      prompt: z.string().min(3).max(400),
      name: z.string().max(40).optional(),
    }),
  },
  "automation.create": {
    title: "أنشئ قاعدة ذكية",
    doc: "قاعدة (متى → افعل) تنفّذها النواة تلقائيًا. when واحد من: boot, focus-lost, agent-done, file-written, night, noon.",
    schema: z.object({
      label: z.string().max(60),
      when: z.enum(["boot", "agent-done", "file-written", "night", "noon"]),
      then: z
        .array(z.object({ op: z.string(), args: z.record(z.string(), z.unknown()).optional() }))
        .min(1)
        .max(4),
    }),
  },
  "automation.toggle": {
    title: "بدّل قاعدة",
    doc: "يفعّل أو يوقف قاعدة ذكية.",
    schema: z.object({ id: z.string() }),
  },
  say: {
    title: "تحدّث",
    doc: "يضيف ردًا نصيًا من نوفا إلى الحوار. استخدمه للشرح أو الإجابة دون تنفيذ شيء.",
    schema: z.object({ text: z.string().min(1).max(1200) }),
  },
  "clipboard.set": {
    title: "انسخ",
    doc: "يضع نصًا في حافظة النظام.",
    schema: z.object({ text: z.string().max(4000) }),
  },
  power: {
    title: "الطاقة",
    doc: "lock يقفل الجلسة، unlock يفتحها، reboot يعيد التشغيل، zen يخفي كل الواجهة ما عدا النافذة النشطة.",
    schema: z.object({ action: z.enum(["lock", "unlock", "reboot", "zen"]) }),
  },
  "app.install": {
    title: "ثبّت تطبيقًا مولّدًا",
    doc: "داخلي: يثبّت مواصفة تطبيق بعد نجاح التوليد.",
    schema: z.object({
      id: z.string(),
      name: z.string().max(40),
      icon: z.string().max(3),
      prompt: z.string().max(400),
      spec: z.unknown(),
      source: z.enum(["neural", "reflex"]),
    }),
  },
  "agent.finish": {
    title: "أنهِ وكيلًا بتقرير",
    doc: "داخلي: يكتب ناتج الوكيل الحقيقي ويقفل مهمته.",
    schema: z.object({
      id: z.string(),
      report: z.string().max(20000),
      source: z.enum(["neural", "reflex"]),
    }),
  },
  "agent.step": {
    title: "خطوة وكيل",
    doc: "داخلي: يتقدّم بوكيل خطوة واحدة.",
    schema: z.object({ id: z.string() }),
  },
  "journal.rewind": {
    title: "أرجع الزمن",
    doc: "يعيد النظام إلى حالته عند تسلسل معيّن في السجل (إرجاع زمني حقيقي).",
    schema: z.object({ seq: z.number().int().min(0) }),
  },
} as const;

export type SyscallOp = keyof typeof SYSCALLS;

export function isSyscall(op: string): op is SyscallOp {
  return Object.prototype.hasOwnProperty.call(SYSCALLS, op);
}

/** يتحقق من نداء ويعيد نسخة منقّاة منه، أو خطأ مقروءًا */
export function validateCall(
  call: SyscallCall
): { ok: true; call: SyscallCall } | { ok: false; error: string } {
  if (!call || typeof call.op !== "string") return { ok: false, error: "نداء بلا عملية" };
  if (!isSyscall(call.op)) return { ok: false, error: `عملية غير معروفة: ${call.op}` };
  const parsed = SYSCALLS[call.op].schema.safeParse(call.args ?? {});
  if (!parsed.success) {
    return { ok: false, error: `وسائط غير صالحة لـ ${call.op}: ${parsed.error.issues[0]?.message ?? ""}` };
  }
  return { ok: true, call: { op: call.op, args: parsed.data as Record<string, unknown> } };
}

/** يمرّر فقط النداءات الصالحة — الحاجز الذي يحمي النواة من أي مُخطِّط */
export function sanitizePlan(calls: unknown): { calls: SyscallCall[]; rejected: string[] } {
  const out: SyscallCall[] = [];
  const rejected: string[] = [];
  if (!Array.isArray(calls)) return { calls: out, rejected: ["الخطة ليست قائمة"] };
  for (const raw of calls.slice(0, 12)) {
    const res = validateCall(raw as SyscallCall);
    if (res.ok) out.push(res.call);
    else rejected.push(res.error);
  }
  return { calls: out, rejected };
}

/** نداءات تخدم النواة نفسها ولا تُعرض لطبقة الذكاء */
const INTERNAL = new Set<string>(["app.install", "agent.step", "agent.finish"]);

/** وصف الجدول لطبقة الذكاء — يُبنى آليًا حتى لا يتخلّف عن الكود أبدًا */
export function syscallManual(): string {
  return Object.entries(SYSCALLS)
    .filter(([op]) => !INTERNAL.has(op))
    .map(([op, def]) => {
      const shape = def.schema instanceof z.ZodObject ? Object.keys(def.schema.shape).join(", ") : "";
      return `- ${op} (${def.title}) [${shape}] :: ${def.doc}`;
    })
    .join("\n");
}
