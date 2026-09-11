/**
 * يحزم نوفا في ملفين ساكنين (nova.js + nova.css) يُوضعان داخل أصول التطبيق.
 *
 * esbuild لا Next: الهدف حزمة تعمل من نظام ملفات التطبيق بلا خادم ولا مسارات
 * API ولا تصيير على الخادم. مسار `@/...` يُحلّ يدويًا لأن tsconfig خاص بـ Next.
 */

import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const out = path.join(here, "android/app/src/main/assets/nova");

await mkdir(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(here, "src/entry.tsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  target: ["chrome100"],
  // الافتراضي يهرّب كل حرف عربي إلى \uXXXX فينتفخ الملف بلا سبب:
  // الأصول تُقدَّم بترميز UTF-8 معلن، فلا حاجة إلى التهريب.
  charset: "utf8",
  jsx: "automatic",
  loader: { ".css": "css" },
  alias: { "@": path.join(repo, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: path.join(out, "nova.js"),
  metafile: true,
  logLevel: "info",
});

await cp(path.join(here, "web/index.html"), path.join(out, "index.html"));
// الأيقونة نفسها التي يستخدمها الويب: طلب favicon الفاشل ضجيج بلا سبب
await cp(path.join(repo, "public/nova-icon.svg"), path.join(out, "icon.svg"));

// تقرير حجم موجز: الحزمة تُثبَّت على هاتف، فالحجم جزء من جودة العمل
const sizes = Object.entries(result.metafile.outputs).map(([file, meta]) => ({
  file: path.basename(file),
  kb: Math.round(meta.bytes / 102.4) / 10,
}));
const html = (await readFile(path.join(here, "web/index.html"), "utf8")).length;
sizes.push({ file: "index.html", kb: Math.round(html / 102.4) / 10 });
await writeFile(path.join(here, "bundle-report.json"), JSON.stringify(sizes, null, 2));
console.table(sizes);
