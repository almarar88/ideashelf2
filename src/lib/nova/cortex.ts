import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { appManual } from "./apps";
import { fallbackSpec, parseSpec, type AppSpec } from "./spec";
import { sanitizePlan, syscallManual } from "./syscalls";
import type { Plan, SyscallCall } from "./types";

/**
 * طبقة العصب (Cortex) — الجانب الخادمي
 *
 * هنا فقط يُستخدم مفتاح Claude، ولا يخرج إلى المتصفح أبدًا.
 * مسؤوليتها الوحيدة: تحويل نية بشرية إلى خطة نداءات نظام.
 * كل ما تعيده يمر على حاجز التحقق في syscalls.ts قبل أن يلمس النواة،
 * أي أن الذكاء يملك بالضبط صلاحيات المستخدم — لا أكثر.
 */

export const MODEL = "claude-opus-5";

export function neuralAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * الوسائط تُطلب كنص JSON لا ككائن حر: مخطط الخرج المهيكل يبقى محدّدًا
 * تمامًا (شرط الوضع الصارم)، والتحقق الحقيقي يتم بعدها بمخططات zod.
 */
const planSchema = z.object({
  say: z.string().describe("رد قصير بالعربية للمستخدم، بصيغة المتحدث عن نفسه، دون حشو"),
  calls: z
    .array(
      z.object({
        op: z.string().describe("اسم نداء النظام حرفيًا من الجدول"),
        args_json: z.string().describe('وسائط النداء كنص JSON صالح، مثال: {"app":"files"}'),
      })
    )
    .describe("النداءات بالترتيب. اجعلها فارغة إذا كان السؤال يحتاج جوابًا فقط"),
});

function systemPrompt(): string {
  return `أنت النواة الذكية لنظام تشغيل اسمه «نوفا». المستخدم يخاطبك بنيّته، ومهمتك تحويلها إلى خطة نداءات نظام.

جدول نداءات النظام (لا تستخدم شيئًا خارجه):
${syscallManual()}

التطبيقات المتاحة لـ win.open:
${appManual()}

قواعد صارمة:
1) لا تخترع نداءً ولا وسيطًا غير مذكور. النداء غير الصالح يُرفض ويُهدر طلب المستخدم.
2) نفّذ ما طُلب فقط. لا تفتح نوافذ إضافية «للمساعدة».
3) إذا طلب المستخدم أداة أو تطبيقًا غير موجود في القائمة، استخدم app.compose بوصف دقيق بدل الاعتذار.
4) إذا كان الطلب سؤالًا معرفيًا أو طلب رأي، أعد calls فارغة وضع الجواب الكامل في say.
5) للألوان استخدم hex. مثال للبنفسجي #7c5cff.
6) اكتب say بالعربية، جملة أو جملتين، بلا مقدمات ولا اعتذارات.
7) عند الطلب المركّب نفّذ كل أجزائه في نداءات متسلسلة (مثلاً: وضع ليلي + ترتيب شبكة + فتح المحرّر).`;
}

export async function neuralPlan(
  intent: string,
  context: string
): Promise<{ plan: Plan; rejected: string[] } | null> {
  if (!neuralAvailable()) return null;
  const started = Date.now();
  try {
    const res = await client().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      // نية على شريط أوامر: الأولوية للاستجابة السريعة لا للتأمل الطويل
      output_config: { effort: "low", format: zodOutputFormat(planSchema) },
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `حالة النظام الآن:\n${context}\n\nنيّة المستخدم:\n«${intent}»`,
        },
      ],
    });

    const parsed = res.parsed_output;
    if (!parsed) return null;

    const raw: SyscallCall[] = parsed.calls.map((c) => {
      let args: Record<string, unknown> = {};
      try {
        const obj = JSON.parse(c.args_json || "{}");
        if (obj && typeof obj === "object" && !Array.isArray(obj)) args = obj as Record<string, unknown>;
      } catch {
        args = {};
      }
      return { op: c.op, args };
    });

    const { calls, rejected } = sanitizePlan(raw);
    return {
      plan: { say: parsed.say, calls, source: "neural", latency: Date.now() - started },
      rejected,
    };
  } catch (err) {
    console.error("[nova] فشل تخطيط العصب:", err instanceof Error ? err.message : err);
    return null;
  }
}

const SPEC_GRAMMAR = `القواعد النحوية للواجهة (JSON فقط، لا شرح، لا أسوار كود):
{
  "name": "اسم قصير",
  "icon": "رمز واحد مثل ✧ أو 💧",
  "tagline": "سطر يشرح الفائدة",
  "state": { "مفتاح": "قيمة ابتدائية (نص أو رقم أو منطقي أو قائمة نصوص)" },
  "root": <عقدة>
}

العقد المسموحة حصرًا:
{"t":"stack","dir":"col|row","gap":0-32,"wrap":bool,"children":[...]}
{"t":"grid","cols":1-4,"children":[...]}
{"t":"card","title":"...","children":[...]}
{"t":"text","value":"...","size":"xs|sm|md|lg|xl","tone":"default|accent|ok|warn|danger|muted","bold":bool}
{"t":"metric","label":"...","value":"...","hint":"...","tone":"..."}
{"t":"badge","label":"...","tone":"..."}
{"t":"divider"}
{"t":"button","label":"...","tone":"...","on":{ ... حركة ... }}
{"t":"input","key":"مفتاح","label":"...","placeholder":"...","kind":"text|number|area"}
{"t":"toggle","key":"مفتاح","label":"..."}
{"t":"list","from":"مفتاح قائمة","empty":"...","items":[{"title":"...","sub":"...","tone":"..."}]}
{"t":"bars","label":"...","data":[{"label":"س","value":12}]}
{"t":"progress","label":"...","value":0-100}

الحركات في on (واحدة أو أكثر):
{"set":{"key":"م","value":"قيمة"}} | {"inc":{"key":"م","by":1}} |
{"push":{"list":"قائمة","from":"مفتاح الحقل"}} | {"clear":"مفتاح"} |
{"run":{"op":"نداء نظام","args":{...}}}

أي نص في value أو label يقبل {{مفتاح}} ليُستبدل بقيمة الحالة لحظيًا.
لا تستخدم أي مفتاح أو نوع غير مذكور أعلاه — ما يخرج عن هذه القواعد يُرفض كاملًا.`;

export async function neuralCompose(prompt: string): Promise<{ spec: AppSpec; source: "neural" | "reflex" }> {
  if (!neuralAvailable()) return { spec: fallbackSpec(prompt), source: "reflex" };
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: `أنت مُصمّم تطبيقات داخل نظام «نوفا». تصنع تطبيقًا حقيقيًا صالحًا للاستخدام من وصف بالكلمات، مكتوبًا بلغة الواجهات المعلنة أدناه.

${SPEC_GRAMMAR}

معايير الجودة:
- التطبيق يجب أن يكون *مفيدًا فعلًا* لا عرضًا تجريبيًا: حقول تُدخل، أزرار تعمل، أرقام تتغيّر.
- ابدأ بقيم ابتدائية واقعية في state حتى تبدو الواجهة حيّة من أول لحظة.
- استخدم {{...}} لربط الأرقام والنصوص بالحالة.
- كل النصوص بالعربية.
- أعد JSON خامًا فقط.`,
      messages: [{ role: "user", content: `اصنع تطبيقًا: ${prompt}` }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const jsonText = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText;

    const spec = parseSpec(JSON.parse(candidate));
    if (spec) return { spec, source: "neural" };
    console.warn("[nova] المواصفة المولّدة لم تعبر التحقق — عُدنا للمواصفة الاحتياطية");
  } catch (err) {
    console.error("[nova] فشل التكوين:", err instanceof Error ? err.message : err);
  }
  return { spec: fallbackSpec(prompt), source: "reflex" };
}

export async function neuralAsk(question: string, context: string): Promise<string | null> {
  if (!neuralAvailable()) return null;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system:
        "أنت نوفا، نواة نظام تشغيل ذكي. تجيب بالعربية، بدقة وإيجاز، وبنبرة واثقة هادئة. لا تكرر السؤال ولا تعتذر. إن كان الجواب رأيًا فقل إنه رأي.",
      messages: [{ role: "user", content: context ? `${context}\n\n${question}` : question }],
    });
    return (
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim() || null
    );
  } catch (err) {
    console.error("[nova] فشل السؤال:", err instanceof Error ? err.message : err);
    return null;
  }
}
