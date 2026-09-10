"use client";

import { useNova } from "../kernel-context";

/** الخط الزمني: كل نداء نقطة يمكن الرجوع إليها. النظام يُعاد بناؤه بإعادة تشغيل السجل. */
export default function Timeline() {
  const { state, rewind } = useNova();
  const entries = [...state.journal].reverse();

  return (
    <div className="app">
      <div className="card">
        <h4>آلة الزمن</h4>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.7 }}>
          لا يوجد «تراجع» مبنيّ في كل تطبيق على حِدة. لأن كل تغيير في نوفا يمرّ عبر نداء نظام
          واحد نقي، فإن إرجاع النظام = إعادة تشغيل السجل على نقطة الأساس. الرجوع يشمل النوافذ
          والمظهر والملفات والقواعد معًا.
          <br />
          <span className="faint">النطاق: هذه الجلسة (السجل لا يُحفظ بين الجلسات بقصد).</span>
        </div>
      </div>

      <div className="row">
        <span className="chip">{state.journal.length} نقطة</span>
        <span className="chip">التسلسل الحالي {state.seq}</span>
        <div className="grow" />
        <button className="btn tiny" onClick={() => rewind(0)} disabled={state.journal.length === 0}>
          ارجع إلى بداية الجلسة
        </button>
      </div>

      <div className="scroll grow">
        {entries.length === 0 && <div className="empty">لم يحدث شيء بعد في هذه الجلسة</div>}
        {entries.map((j) => (
          <div key={j.seq} className={`tl-row ${j.ok ? "" : "bad"}`}>
            <span className="mono faint">{String(j.seq).padStart(3, "0")}</span>
            <div style={{ minWidth: 0 }}>
              <div className="mono ltr" style={{ fontSize: 12 }}>
                {j.ok ? "✓" : "✗"} {j.call.op}{" "}
                <span className="faint">{JSON.stringify(j.call.args ?? {}).slice(0, 70)}</span>
              </div>
              <div className="faint" style={{ fontSize: 11 }}>
                {j.origin} · {new Date(j.at).toLocaleTimeString("ar")}
                {j.note ? ` · ${j.note}` : ""}
              </div>
            </div>
            <button className="btn tiny" onClick={() => rewind(j.seq)}>
              ارجع هنا
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
