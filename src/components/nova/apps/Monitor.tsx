"use client";

import { useNova } from "../kernel-context";

/** المراقب: لا يعرض عمليات معالج، بل نوايا ووكلاء ونداءات — وحدات هذا النظام الحقيقية. */
export default function Monitor() {
  const { state, run, neural, model } = useNova();
  const running = state.agents.filter((a) => a.state === "running");

  return (
    <div className="app split-h">
      <div className="pane grow scroll app-pad">
        <h4 style={{ marginBottom: 8 }}>الوكلاء ({running.length} يعمل)</h4>
        {state.agents.length === 0 && (
          <div className="faint" style={{ fontSize: 12.5 }}>
            لا وكلاء. جرّب: «أطلق وكيلًا يجهّز تقرير الربع».
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {state.agents.map((a) => {
            const done = a.steps.filter((s) => s.done).length;
            return (
              <div key={a.id} className="card">
                <div className="row">
                  <span className="grow" style={{ fontWeight: 600, fontSize: 12.5 }}>
                    {a.name}
                  </span>
                  <span className={`chip ${a.state === "done" ? "ok" : a.state === "failed" ? "danger" : "on"}`}>
                    {a.state === "running" ? "يعمل" : a.state === "done" ? "أنجز" : "أُوقف"}
                  </span>
                  {a.state === "running" && (
                    <button className="btn tiny" onClick={() => run({ op: "agent.kill", args: { id: a.id } })}>
                      إيقاف
                    </button>
                  )}
                </div>
                <div className="dim" style={{ fontSize: 12, margin: "5px 0 8px" }}>
                  {a.goal}
                </div>
                <div className="bar-track">
                  <i style={{ width: `${(done / a.steps.length) * 100}%` }} />
                </div>
                <div style={{ marginTop: 7 }}>
                  {a.steps.map((s, i) => (
                    <div key={i} className="row" style={{ fontSize: 11.5 }}>
                      <span style={{ color: s.done ? "var(--ok)" : "var(--ink-faint)" }}>{s.done ? "✔" : "○"}</span>
                      <span className={s.done ? "" : "faint"}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="faint mono" style={{ marginTop: 6 }}>
                  {a.id} · cpu {a.cpu}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pane scroll app-pad" style={{ width: "44%", minWidth: 210 }}>
        <h4 style={{ marginBottom: 8 }}>طبقة الذكاء</h4>
        <div className="kv">
          <span className="dim">المُخطِّط</span>
          <span>{neural ? model : "انعكاس محلي"}</span>
        </div>
        <div className="kv">
          <span className="dim">نداءات نُفّذت</span>
          <span className="mono">{state.cortex.calls}</span>
        </div>
        <div className="kv">
          <span className="dim">زمن آخر خطة</span>
          <span className="mono">{state.cortex.lastLatency} ms</span>
        </div>
        <div className="kv">
          <span className="dim">حجم السجل</span>
          <span className="mono">{state.journal.length}</span>
        </div>
        <div className="kv">
          <span className="dim">عناصر المحتوى</span>
          <span className="mono">{state.fs.length}</span>
        </div>

        <h4 style={{ margin: "12px 0 6px" }}>آخر النداءات</h4>
        <div className="mono ltr" style={{ lineHeight: 1.9 }}>
          {[...state.journal]
            .reverse()
            .slice(0, 22)
            .map((j) => (
              <div key={j.seq} className={j.ok ? "" : "tl-row bad"} style={{ display: "flex", gap: 6 }}>
                <span className="faint">{String(j.seq).padStart(3, "0")}</span>
                <span style={{ color: j.ok ? "var(--ok)" : "var(--danger)" }}>{j.ok ? "✓" : "✗"}</span>
                <span className="grow">{j.call.op}</span>
                <span className="faint">{j.origin}</span>
              </div>
            ))}
          {state.journal.length === 0 && <span className="faint">السجل فارغ</span>}
        </div>
      </div>
    </div>
  );
}
