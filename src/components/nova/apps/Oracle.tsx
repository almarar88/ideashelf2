"use client";

import { useEffect, useRef, useState } from "react";
import { useNova } from "../kernel-context";

/** الأوراكل: حوار واحد يقود النظام كله. ما تكتبه هنا يصبح نداءات نظام. */
export default function Oracle() {
  const { state, submit, busy, lastPlan, neural, model } = useNova();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.dialog.length, busy]);

  const send = () => {
    const v = text.trim();
    if (!v || busy) return;
    setText("");
    void submit(v);
  };

  return (
    <div className="app">
      <div className="row">
        <span className="chip on">{neural ? `عصب · ${model}` : "انعكاس محلي"}</span>
        <span className="chip">{state.cortex.calls} نداء منفّذ</span>
        {state.cortex.lastLatency > 0 && <span className="chip">{state.cortex.lastLatency}ms</span>}
      </div>

      <div className="scroll grow" style={{ display: "flex", flexDirection: "column", gap: 8, paddingInline: 2 }}>
        {state.dialog.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: 26 }}>◈</div>
            <div>أنا نوفا. لا تبحث عن زر — قل ما تريد.</div>
            <div className="faint" style={{ fontSize: 12 }}>
              «رتّب النوافذ»، «اصنع تطبيقًا لعاداتي»، «احسب ٨٤×٧»
            </div>
          </div>
        )}
        {state.dialog.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "me" : "from-nova"}`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="thinking">
            <i />
            <i />
            <i />
            <span>يخطّط…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {lastPlan && lastPlan.calls.length > 0 && (
        <div className="card mono faint ltr" style={{ maxHeight: 92, overflow: "auto" }}>
          {lastPlan.calls.map((c, i) => (
            <div key={i}>
              ✓ {c.op} {JSON.stringify(c.args ?? {})}
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <input
          className="field"
          placeholder="اكتب نيّتك…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn primary" onClick={send} disabled={busy}>
          نفّذ
        </button>
      </div>
    </div>
  );
}
