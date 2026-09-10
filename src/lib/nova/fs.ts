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
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = fs.map((n) => {
    let score = 0;
    const hay = `${n.path} ${n.tags.join(" ")} ${n.content}`.toLowerCase();
    for (const t of terms) {
      if (n.path.toLowerCase().includes(t)) score += 6;
      if (n.tags.some((tag) => tag.toLowerCase().includes(t))) score += 4;
      if (hay.includes(t)) score += 2;
    }
    return { n, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((s) => s.n);
}
