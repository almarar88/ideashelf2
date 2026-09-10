"use client";

import { useState } from "react";
import { useNova } from "../kernel-context";

const WHENS: { key: string; label: string }[] = [
  { key: "boot", label: "عند الإقلاع" },
  { key: "agent-done", label: "عند انتهاء وكيل" },
  { key: "file-written", label: "عند كتابة ملف" },
  { key: "night", label: "في المساء" },
  { key: "noon", label: "في الظهيرة" },
];

const THENS: { label: string; call: { op: string; args?: Record<string, unknown> } }[] = [
  { label: "افتح الأوراكل", call: { op: "win.open", args: { app: "oracle" } } },
  { label: "افتح المراقب", call: { op: "win.open", args: { app: "monitor" } } },
  { label: "رتّب شبكة", call: { op: "win.arrange", args: { mode: "grid" } } },
  { label: "وضع ليلي", call: { op: "theme.set", args: { mode: "night" } } },
  { label: "وضع الفجر", call: { op: "theme.set", args: { mode: "dawn" } } },
  { label: "أشعرني", call: { op: "notify", args: { title: "قاعدة نوفا اشتغلت", level: "info" } } },
  { label: "وضع التركيز", call: { op: "power", args: { action: "zen" } } },
];

/** القواعد: أتمتة معلنة تنفّذها النواة عند أحداث النظام. */
export default function Rules() {
  const { state, run, fireEvent } = useNova();
  const [when, setWhen] = useState("boot");
  const [pick, setPick] = useState(0);

  const create = () => {
    const chosen = THENS[pick];
    run({
      op: "automation.create",
      args: {
        label: `${WHENS.find((w) => w.key === when)?.label}: ${chosen.label}`,
        when,
        then: [chosen.call],
      },
    });
  };

  return (
    <div className="app">
      <div className="card">
        <h4>قاعدة جديدة</h4>
        <div className="row" style={{ marginTop: 9, flexWrap: "wrap" }}>
          <span className="dim">متى</span>
          {WHENS.map((w) => (
            <button
              key={w.key}
              className={`chip ${when === w.key ? "on" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setWhen(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 9, flexWrap: "wrap" }}>
          <span className="dim">افعل</span>
          {THENS.map((t, i) => (
            <button
              key={t.label}
              className={`chip ${pick === i ? "on" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setPick(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 11 }} onClick={create}>
          أضف القاعدة
        </button>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.75 }}>
          كل الأحداث فعّالة: الإقلاع، وانتهاء وكيل، وكتابة ملف، وساعة النظام تُطلق
          «المساء» بعد السابعة و«الظهيرة» عند الثانية عشرة — مرة واحدة لكل يوم.
          ولأن القواعد تنفّذ نداءات نظام، فإن ما تفعله يُسجّل ويمكن الرجوع عنه.
        </div>
      </div>

      <div className="scroll grow">
        <h4 style={{ marginBottom: 7 }}>القواعد ({state.automations.length})</h4>
        {state.automations.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 8 }}>
            <div className="row">
              <span className="grow" style={{ fontSize: 12.5, fontWeight: 600 }}>
                {a.label}
              </span>
              <span className="chip">{a.hits} مرة</span>
              <button className="btn tiny" onClick={() => fireEvent(a.when, { agent: "تجربة" })}>
                جرّب الآن
              </button>
              <button className="btn tiny" onClick={() => run({ op: "automation.toggle", args: { id: a.id } })}>
                {a.enabled ? "إيقاف" : "تفعيل"}
              </button>
            </div>
            <div className="mono faint ltr" style={{ marginTop: 6 }}>
              when={a.when} → {a.then.map((c) => c.op).join(", ")} · {a.enabled ? "نشطة" : "موقوفة"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
