import { related, tokens } from "./text";
import type { FsNode } from "./types";

/**
 * نظام ملفات دلالي: لا شجرة تُتنقّل يدويًا، بل مسارات + وسوم
 * تجعل البحث بالمعنى هو الطريقة الطبيعية للوصول إلى أي شيء.
 */

let counter = 0;
export function nid(prefix = "n"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

function file(path: string, content: string, tags: string[], author = "nova"): FsNode {
  return {
    id: nid("f"),
    path: normalize(path),
    kind: "file",
    content,
    tags,
    mime: path.endsWith(".md") ? "text/markdown" : "text/plain",
    updatedAt: Date.now(),
    author,
  };
}

export function normalize(p: string): string {
  const cleaned = p.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  const withRoot = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return withRoot.length > 1 ? withRoot.replace(/\/$/, "") : withRoot;
}

export function basename(p: string): string {
  const parts = normalize(p).split("/");
  return parts[parts.length - 1] || "/";
}

export function dirname(p: string): string {
  const parts = normalize(p).split("/");
  parts.pop();
  return parts.join("/") || "/";
}

const MIME: Record<string, string> = {
  md: "text/markdown",
  txt: "text/plain",
  log: "text/plain",
  json: "application/json",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** نوع المحتوى من الامتداد — صار مهمًّا بعد أن قبِل النظام ملفات حقيقية */
export function mimeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "text/plain";
}

export function isImage(node: { mime: string }): boolean {
  return node.mime.startsWith("image/");
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب`;
}

export function seedFs(): FsNode[] {
  return [
    file(
      "/بيتي/اقرأني.md",
      `# مرحبًا في نوفا

أنت لا تتعامل مع نظام يحتاج أن تتعلّمه، بل مع نظام يتعلّمك.

اضغط **Ctrl + K** واكتب ما تريد بأي صيغة:
- «رتّب النوافذ شبكة»
- «اصنع لي تطبيق لمتابعة شرب الماء»
- «ابحث عن كل ما يخص المزرعة»
- «وضع ليلي بلون بنفسجي»

كل ما يحدث في النظام يمرّ عبر نداء نظام واحد مُسجّل، ولهذا يمكنك
العودة بالزمن من تطبيق «الخط الزمني» وإلغاء أي شيء حدث.`,
      ["دليل", "بداية", "مساعدة"],
      "kernel"
    ),
    file(
      "/بيتي/أفكار/مشروع-النخيل.md",
      `## فكرة: طبقة ذكاء لمزرعة النخيل
- تشخيص الأمراض من الصور
- تنبؤ بموعد التلقيح والجداد
- مزاد مباشر للمحصول
الحالة: قيد التنفيذ في مشروع «نخيلي».`,
      ["مزرعة", "نخيل", "مشروع", "ذكاء"],
      "user"
    ),
    file(
      "/بيتي/أفكار/معمار-نوفا.md",
      `## لماذا نداءات النظام؟
واجهة واحدة بين النية والحالة تعني:
1. تسجيل كامل (journal)
2. إرجاع زمني مجاني
3. الذكاء الاصطناعي يقود النظام بنفس الصلاحيات التي يملكها المستخدم — لا أكثر.`,
      ["معمار", "نوفا", "نواة"],
      "user"
    ),
    file(
      "/بيتي/مالية/ميزانية-الربع.txt",
      `الإيراد: 128,400\nالمصروف: 76,900\nالصافي: 51,500\nملاحظة: تكلفة العمالة الموسمية أعلى من المتوقع بـ 12%.`,
      ["مال", "ميزانية", "تقرير"],
      "user"
    ),
    file(
      "/النظام/سجل-الإقلاع.log",
      `nova kernel 1.0 · syscall-driven · cortex=auto\nالنواة أقلعت بنجاح.`,
      ["نظام", "سجل"],
      "kernel"
    ),
  ];
}

export function searchFs(fs: FsNode[], query: string): FsNode[] {
  const terms = tokens(query).filter((t) => t.length >= 2);
  if (terms.length === 0) return [];

  const scored = fs.map((n) => {
    const pathWords = tokens(n.path);
    const tagWords = n.tags.flatMap((t) => tokens(t));
    const bodyWords = tokens(n.content);
    let score = 0;

    for (const term of terms) {
      // المسار أقوى دليل، ثم الوسم، ثم المحتوى — ومطابقة الجذر تُحتسب أقل
      if (pathWords.some((w) => w === term)) score += 7;
      else if (pathWords.some((w) => related(term, w))) score += 5;

      if (tagWords.some((w) => w === term)) score += 5;
      else if (tagWords.some((w) => related(term, w))) score += 3;

      if (bodyWords.some((w) => w === term)) score += 2;
      else if (bodyWords.some((w) => related(term, w))) score += 1;
    }
    return { n, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.n.updatedAt - a.n.updatedAt)
    .slice(0, 40)
    .map((s) => s.n);
}
