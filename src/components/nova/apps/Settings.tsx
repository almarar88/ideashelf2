"use client";

import { useNova } from "../kernel-context";

const ACCENTS = ["#7c5cff", "#3b82f6", "#22d3ee", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];
const WALLS: { key: string; label: string }[] = [
  { key: "aurora", label: "شفق" },
  { key: "dune", label: "كثبان" },
  { key: "abyss", label: "عمق" },
  { key: "silk", label: "حرير" },
  { key: "grid", label: "شبكة" },
];

/** الهوية: كل تغيير هنا نداء نظام — أي أنه قابل للإرجاع مثل أي شيء آخر. */
export default function Settings() {
  const { state, run, reset, neural, model } = useNova();
  const t = state.theme;

  return (
    <div className="app scroll">
      <div className="card">
        <h4>الوضع</h4>
        <div className="row" style={{ marginTop: 8 }}>
          {(["night", "dawn"] as const).map((m) => (
            <button
              key={m}
              className={`btn ${t.mode === m ? "primary" : ""}`}
              onClick={() => run({ op: "theme.set", args: { mode: m } })}
            >
              {m === "night" ? "ليل" : "فجر"}
            </button>
          ))}
          <div className="grow" />
          <button
            className={`btn ${t.motion ? "primary" : ""}`}
            onClick={() => run({ op: "theme.set", args: { motion: !t.motion } })}
          >
            {t.motion ? "الحركة مفعّلة" : "الحركة مطفأة"}
          </button>
        </div>
      </div>

      <div className="card">
        <h4>لون التمييز</h4>
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              className={`swatch ${t.accent === c ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => run({ op: "theme.set", args: { accent: c } })}
              title={c}
            />
          ))}
          <span className="mono faint">{t.accent}</span>
        </div>
      </div>

      <div className="card">
        <h4>الخلفية</h4>
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {WALLS.map((w) => (
            <button
              key={w.key}
              className={`chip ${t.wallpaper === w.key ? "on" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => run({ op: "theme.set", args: { wallpaper: w.key } })}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>
            شفافية الزجاج
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(t.glass * 100)}
            onChange={(e) => run({ op: "theme.set", args: { glass: Number(e.target.value) / 100 } })}
            style={{ flex: 1 }}
          />
          <span className="mono faint">{Math.round(t.glass * 100)}%</span>
        </div>
      </div>

      <div className="card">
        <h4>طبقة الذكاء</h4>
        <div className="kv">
          <span className="dim">المُخطِّط الحالي</span>
          <span>{neural ? "العصب (Claude)" : "الانعكاس المحلي"}</span>
        </div>
        <div className="kv">
          <span className="dim">الطراز</span>
          <span className="mono">{neural ? model : "reflex/1.0"}</span>
        </div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 9, lineHeight: 1.75 }}>
          {neural
            ? "العصب يخطّط بحرية داخل جدول نداءات النظام فقط. أي نداء لا يطابق مخططه يُرفض قبل أن يلمس الحالة، أي أن الذكاء يملك صلاحياتك لا أكثر."
            : "لا يوجد ANTHROPIC_API_KEY في البيئة، فيعمل النظام بطبقة الانعكاس المحلية: حتمية، بلا شبكة، وتفهم الصيغ الشائعة. أضف المفتاح لتفتح التخطيط الحر وتوليد التطبيقات العصبي."}
        </div>
      </div>

      <div className="card">
        <h4>الجلسة</h4>
        <div className="kv">
          <span className="dim">المستخدم</span>
          <span>
            {state.user.name} <span className="faint mono">{state.user.handle}</span>
          </span>
        </div>
        <div className="kv">
          <span className="dim">النوافذ / المحتوى / المولّد</span>
          <span className="mono">
            {state.windows.length} / {state.fs.length} / {state.composed.length}
          </span>
        </div>
        <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => run({ op: "power", args: { action: "reboot" } })}>
            إعادة تشغيل النواة
          </button>
          <button className="btn" onClick={() => run({ op: "power", args: { action: "lock" } })}>
            قفل
          </button>
          <button className="btn" style={{ color: "var(--danger)" }} onClick={reset}>
            مسح الجلسة والعودة للمصنع
          </button>
        </div>
      </div>
    </div>
  );
}
