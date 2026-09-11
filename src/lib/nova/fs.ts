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

اضغط **Ctrl + K** (أو المس ◈ في الشريط السفلي) واكتب ما تريد بأي صيغة:
- «رتّب النوافذ شبكة»
- «اصنع لي تطبيقًا لمتابعة شرب الماء»
- «احسب 1280 × 12»
- «مؤقّت عشر دقائق»
- «وضع ليلي بلون بنفسجي»
- «انتقل إلى السطح الثاني»

كل ما يحدث في النظام يمرّ عبر نداء نظام واحد مُسجّل، ولهذا يمكنك العودة
بالزمن من «الخط الزمني» وإلغاء أي شيء حدث — نوافذ ومظهرًا وملفات وقواعد.`,
      ["دليل", "بداية", "مساعدة"],
      "kernel"
    ),
    file(
      "/بيتي/أفكار/كيف-يعمل-هذا-النظام.md",
      `## القيد الواحد

لا شيء في نوفا يغيّر الحالة إلا عبر **نداء نظام** مُعرَّف ومُتحقَّق منه.

من هذا القيد وحده تأتي أربع نتائج بلا كلفة إضافية:

1. **سجل كامل** — كل تغيير يمرّ من نقطة واحدة، فيُسجّل هناك.
2. **إرجاع زمني حقيقي** — النواة دالة نقية، فإعادة تشغيل السجل تُعيد البناء.
3. **قيادة بالذكاء** — نفس الجدول الذي تنفّذه النواة يتعلّمه المُخطِّط.
4. **صلاحيات** — ما دامت كل قدرة مسمّاة، صار بالإمكان أن تكون مملوكة.`,
      ["معمار", "نوفا", "نواة"],
      "user"
    ),
    file(
      "/بيتي/أفكار/تطبيقات-أريدها.md",
      `- [ ] لوحة تتابع عاداتي اليومية
- [ ] حاسبة قروض بأقساط
- [ ] متتبّع قراءة مع هدف أسبوعي

جرّب: «اصنع لي تطبيقًا لمتابعة عاداتي» — النظام يولّده ويثبّته في الشريط.`,
      ["أفكار", "توليد", "مهام"],
      "user"
    ),
    file(
      "/بيتي/مسودة.md",
      "مساحة فارغة للكتابة. اضغط Ctrl+S للحفظ.",
      ["كتابة", "مسودة"],
      "user"
    ),
    file(
      "/النظام/سجل-الإقلاع.log",
      `nova kernel 1.1 · syscall-driven · cortex=auto\nالنواة أقلعت بنجاح.`,
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
