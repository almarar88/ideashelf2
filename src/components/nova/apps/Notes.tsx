"use client";

import { useState } from "react";
import { useNova } from "../kernel-context";
import type { NovaWindow } from "@/lib/nova/types";

/** الكتابة: محرّر يكتب في نظام الملفات عبر نداء نظام، ويستعين بالعصب عند الطلب. */
export default function Notes({ win }: { win: NovaWindow }) {
  const { state, run, ask, neural } = useNova();
  const initial = String(win.props.path ?? "/بيتي/مسودة.md");
  const [path, setPath] = useState(initial);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // تحميل عند تغيّر المسار فقط، بنمط «ضبط الحالة عند تغيّر المدخل» أثناء التصيير:
  // لو حمّلنا داخل effect لكان النص يُستبدل من تحت يد المستخدم أثناء الكتابة.
  if (loaded !== path) {
    setLoaded(path);
    setBody(state.fs.find((x) => x.path === path)?.content ?? "");
    setDirty(false);
  }

  const save = () => {
    run({ op: "fs.write", args: { path, content: body, tags: ["محرّر"] } });
    setDirty(false);
  };

  const assist = async (mode: "summary" | "expand" | "polish") => {
    if (!body.trim()) return;
    setWorking(mode);
    const instruction =
      mode === "summary"
        ? "اختصر النص التالي إلى خلاصة من نقاط قصيرة."
        : mode === "expand"
        ? "وسّع النص التالي بتفاصيل عملية دون حشو."
        : "حسّن صياغة النص التالي مع الحفاظ على المعنى والطول تقريبًا.";
    const answer = await ask(instruction, body);
    setWorking(null);
    if (!answer) {
      run({
        op: "notify",
        args: { title: "طبقة العصب غير متاحة", body: "أضف ANTHROPIC_API_KEY لتمكين مساعدة الكتابة", level: "warn" },
      });
      return;
    }
    setBody(mode === "summary" ? `${body}\n\n---\n## خلاصة\n${answer}` : answer);
    setDirty(true);
  };

  return (
    <div className="app">
      <div className="row">
        <input className="field grow" value={path} onChange={(e) => setPath(e.target.value)} />
        <button className="btn primary" onClick={save} disabled={!dirty}>
          {dirty ? "حفظ" : "محفوظ"}
        </button>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn tiny" disabled={!!working} onClick={() => void assist("summary")}>
          {working === "summary" ? "…" : "خلاصة"}
        </button>
        <button className="btn tiny" disabled={!!working} onClick={() => void assist("expand")}>
          {working === "expand" ? "…" : "توسيع"}
        </button>
        <button className="btn tiny" disabled={!!working} onClick={() => void assist("polish")}>
          {working === "polish" ? "…" : "تحسين الصياغة"}
        </button>
        {!neural && <span className="chip warn">المساعدة تحتاج مفتاحًا</span>}
        <div className="grow" />
        <span className="faint mono">{body.length} حرفًا</span>
      </div>
      <textarea
        className="editor"
        value={body}
        placeholder="اكتب… ثم استعن بالأزرار أعلاه."
        onChange={(e) => {
          setBody(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            save();
          }
        }}
      />
    </div>
  );
}
