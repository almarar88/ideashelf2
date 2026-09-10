import { z } from "zod";

/**
 * لغة الواجهات المولّدة (Materia)
 *
 * نوفا تصنع تطبيقات جديدة بالذكاء الاصطناعي، لكنها لا تشغّل كودًا مولّدًا أبدًا.
 * ما يولّده الذكاء هو *وصف* واجهة بلغة معلنة محدودة يفحصها المخطط أدناه،
 * ثم يرسمها مفسّر آمن. لا eval، ولا new Function، ولا حقن سكربتات:
 * أسوأ ما يمكن أن ينتجه توليد فاشل هو واجهة قبيحة، لا ثغرة.
 */

const tone = z.enum(["default", "accent", "ok", "warn", "danger", "muted"]);

const action = z.object({
  /** نداء نظام حقيقي — يمر على نفس حاجز التحقق */
  run: z.object({ op: z.string(), args: z.record(z.string(), z.unknown()).optional() }).optional(),
  /** تعديل حالة محلية للتطبيق */
  set: z.object({ key: z.string().max(40), value: z.union([z.string(), z.number(), z.boolean()]) }).optional(),
  inc: z.object({ key: z.string().max(40), by: z.number() }).optional(),
  /** إضافة نص الحقل إلى قائمة محلية */
  push: z.object({ list: z.string().max(40), from: z.string().max(40) }).optional(),
  clear: z.string().max(40).optional(),
});

type NodeShape = z.ZodType;

export const nodeSchema: NodeShape = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({
      t: z.literal("stack"),
      dir: z.enum(["row", "col"]).optional(),
      gap: z.number().min(0).max(32).optional(),
      wrap: z.boolean().optional(),
      children: z.array(nodeSchema).max(24),
    }),
    z.object({
      t: z.literal("grid"),
      cols: z.number().int().min(1).max(4),
      children: z.array(nodeSchema).max(24),
    }),
    z.object({
      t: z.literal("card"),
      title: z.string().max(80).optional(),
      children: z.array(nodeSchema).max(20),
    }),
    z.object({
      t: z.literal("text"),
      value: z.string().max(1200),
      size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      tone: tone.optional(),
      bold: z.boolean().optional(),
    }),
    z.object({
      t: z.literal("metric"),
      label: z.string().max(60),
      value: z.string().max(40),
      hint: z.string().max(80).optional(),
      tone: tone.optional(),
    }),
    z.object({ t: z.literal("badge"), label: z.string().max(40), tone: tone.optional() }),
    z.object({ t: z.literal("divider") }),
    z.object({
      t: z.literal("button"),
      label: z.string().max(48),
      tone: tone.optional(),
      on: action.optional(),
    }),
    z.object({
      t: z.literal("input"),
      key: z.string().max(40),
      label: z.string().max(60).optional(),
      placeholder: z.string().max(80).optional(),
      kind: z.enum(["text", "number", "area"]).optional(),
    }),
    z.object({ t: z.literal("toggle"), key: z.string().max(40), label: z.string().max(60) }),
    z.object({
      t: z.literal("list"),
      from: z.string().max(40).optional(),
      empty: z.string().max(80).optional(),
      items: z
        .array(z.object({ title: z.string().max(120), sub: z.string().max(160).optional(), tone: tone.optional() }))
        .max(30)
        .optional(),
    }),
    z.object({
      t: z.literal("bars"),
      label: z.string().max(60).optional(),
      data: z.array(z.object({ label: z.string().max(24), value: z.number() })).max(14),
    }),
    z.object({
      t: z.literal("progress"),
      label: z.string().max(60),
      value: z.number().min(0).max(100),
    }),
  ])
);

export const appSpecSchema = z.object({
  name: z.string().min(1).max(40),
  icon: z.string().min(1).max(3),
  tagline: z.string().max(120).optional(),
  state: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  root: nodeSchema,
});

export type AppSpec = z.infer<typeof appSpecSchema>;
export type SpecNode = z.infer<typeof nodeSchema>;
export type SpecAction = z.infer<typeof action>;

/** يعيد مواصفة صالحة أو null — لا شيء يُرسم قبل أن يعبر هذا الباب */
export function parseSpec(raw: unknown): AppSpec | null {
  const res = appSpecSchema.safeParse(raw);
  return res.success ? res.data : null;
}

/** استبدال {{مفتاح}} بقيم الحالة المحلية */
export function interpolate(text: string, state: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w؀-ۿ.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = state[key];
    if (v === undefined || v === null) return "—";
    if (Array.isArray(v)) return String(v.length);
    return String(v);
  });
}

/** مواصفة احتياطية تُرسم عند فشل التوليد، حتى لا يرى المستخدم شاشة فارغة */
export function fallbackSpec(prompt: string): AppSpec {
  return {
    name: prompt.slice(0, 24) || "تطبيق جديد",
    icon: "✧",
    tagline: "مولّد محليًا بطبقة الانعكاس",
    state: { count: 0, note: "", items: [] },
    root: {
      t: "stack",
      dir: "col",
      gap: 12,
      children: [
        { t: "text", value: prompt, size: "sm", tone: "muted" },
        {
          t: "card",
          title: "عدّاد",
          children: [
            { t: "metric", label: "القيمة الحالية", value: "{{count}}", tone: "accent" },
            {
              t: "stack",
              dir: "row",
              gap: 8,
              children: [
                { t: "button", label: "+1", tone: "accent", on: { inc: { key: "count", by: 1 } } },
                { t: "button", label: "-1", on: { inc: { key: "count", by: -1 } } },
                { t: "button", label: "تصفير", tone: "muted", on: { set: { key: "count", value: 0 } } },
              ],
            },
          ],
        },
        {
          t: "card",
          title: "قائمة سريعة",
          children: [
            { t: "input", key: "note", placeholder: "أضف عنصرًا…" },
            { t: "button", label: "إضافة", tone: "ok", on: { push: { list: "items", from: "note" } } },
            { t: "list", from: "items", empty: "لا عناصر بعد" },
          ],
        },
      ],
    },
  };
}
