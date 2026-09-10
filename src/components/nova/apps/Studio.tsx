"use client";

import { useState } from "react";
import { useNova } from "../kernel-context";

const IDEAS = [
  "لوحة لمتابعة استهلاك الماء في المزرعة مع هدف يومي",
  "أداة لحساب زكاة المحصول وتسجيل الملاحظات",
  "متتبّع مزاجي أسبوعي مع أعمدة ونسبة إنجاز",
  "قائمة مهام للعمّال مع أولويات وعدّاد منجز",
  "حاسبة تكلفة ريّ لكل نخلة",
];

/** المشغل: تصف تطبيقًا بالكلمات، فيولد ويثبَّت في الشريط السفلي. */
export default function Studio() {
  const { state, compose, run, neural } = useNova();
  const [prompt, setPrompt] = useState("");
  const [sent, setSent] = useState(false);

  const build = async (p: string) => {
    const v = p.trim();
    if (!v) return;
    setSent(true);
    await compose(v);
    setPrompt("");
    window.setTimeout(() => setSent(false), 1400);
  };

  return (
    <div className="app">
      <div className="card">
        <h4>صف التطبيق الذي تريده</h4>
        <div className="dim" style={{ fontSize: 12.5, margin: "6px 0 10px", lineHeight: 1.7 }}>
          يولّد النظام واجهة معلنة مُتحقّقًا منها بمخطط، ثم يرسمها مفسّر آمن. لا يُشغّل كود مولّد أبدًا —
          أقصى ما يمكن أن ينتج عن توليد فاشل واجهة ناقصة، لا ثغرة.
        </div>
        <textarea
          className="field"
          rows={3}
          placeholder="مثال: أداة لمتابعة أدوية النخيل مع جرعات وتنبيه"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="row" style={{ marginTop: 9 }}>
          <button className="btn primary" onClick={() => void build(prompt)} disabled={sent || !prompt.trim()}>
            {sent ? "يُكوّن…" : "كوّن التطبيق"}
          </button>
          <span className={`chip ${neural ? "on" : "warn"}`}>
            {neural ? "توليد عصبي" : "توليد احتياطي محلي"}
          </span>
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: 7 }}>أفكار جاهزة</h4>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {IDEAS.map((i) => (
            <button key={i} className="chip" style={{ cursor: "pointer" }} onClick={() => void build(i)}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="hr" />

      <div className="grow scroll">
        <h4 style={{ marginBottom: 7 }}>التطبيقات المولّدة ({state.composed.length})</h4>
        {state.composed.length === 0 && <div className="faint">لم تولّد شيئًا بعد.</div>}
        {state.composed.map((c) => (
          <div key={c.id} className="list-row" onClick={() => run({ op: "win.open", args: { app: c.id } })}>
            <span style={{ fontSize: 16 }}>{c.icon}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
              <div className="faint" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.prompt}
              </div>
            </div>
            <span className={`chip ${c.source === "neural" ? "on" : "warn"}`}>
              {c.source === "neural" ? "عصبي" : "احتياطي"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
