"use client";

import { CAPS, SYSTEM_CAPS, riskTone, type Capability } from "@/lib/nova/caps";
import { APPS } from "@/lib/nova/apps";
import { useNova } from "../kernel-context";

const ALL = Object.keys(CAPS) as Capability[];

/**
 * الصلاحيات: لوحة واحدة تُظهر من يملك ماذا في هذا النظام.
 * التطبيقات المثبّتة تُعرض كنظام (بلا مفاتيح) لأنها هي النظام؛ والمولّدة
 * تُعرض بمفاتيح تُمنح وتُسحب بنداء نظام مُسجّل مثل أي تغيير آخر.
 */
export default function Guard() {
  const { state, run } = useNova();

  return (
    <div className="app scroll">
      <div className="card">
        <h4>لماذا هذه اللوحة؟</h4>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 7 }}>
          التطبيقات المثبّتة هي النظام وتعمل بصلاحيتك. أما ما يولّده الذكاء
          الاصطناعي فهو كود كتبه نموذج لغوي من وصف بالكلمات: يبدأ بأدنى صلاحية،
          وكل قدرة إضافية تُطلب منك لحظة الحاجة وتُسجّل في السجل.
        </p>
      </div>

      <div>
        <h4 style={{ marginBottom: 8 }}>التطبيقات المولّدة ({state.composed.length})</h4>
        {state.composed.length === 0 && (
          <div className="faint" style={{ fontSize: 12.5 }}>
            لا تطبيقات مولّدة بعد. جرّب «اصنع لي تطبيقًا…» من شريط النيّة.
          </div>
        )}
        {state.composed.map((app) => {
          const granted = state.grants[app.id] ?? [];
          return (
            <div key={app.id} className="card" style={{ marginBottom: 9 }}>
              <div className="row">
                <span style={{ fontSize: 16 }}>{app.icon}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{app.name}</div>
                  <div className="faint mono ltr" style={{ fontSize: 10.5 }}>
                    {app.id}
                  </div>
                </div>
                <span className="chip">{granted.length} صلاحية</span>
              </div>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 9, gap: 5 }}>
                {ALL.map((cap) => {
                  const on = granted.includes(cap);
                  return (
                    <button
                      key={cap}
                      className={`chip ${on ? riskTone(CAPS[cap].risk) : ""}`}
                      style={{ cursor: "pointer" }}
                      title={CAPS[cap].desc}
                      onClick={() =>
                        run({
                          op: on ? "grant.revoke" : "grant.add",
                          args: { app: app.id, cap },
                        })
                      }
                    >
                      {on ? "✔" : "○"} {CAPS[cap].icon} {CAPS[cap].label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hr" />

      <div>
        <h4 style={{ marginBottom: 8 }}>التطبيقات المثبّتة ({APPS.length})</h4>
        <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
          {APPS.map((a) => (
            <span key={a.key} className="chip" title={a.hint}>
              {a.icon} {a.name}
            </span>
          ))}
        </div>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
          تملك {SYSTEM_CAPS.length} صلاحية كاملة — هي مكوّنات النظام نفسه.
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: 8 }}>معجم الصلاحيات</h4>
        {ALL.map((cap) => (
          <div key={cap} className="kv">
            <span>
              {CAPS[cap].icon} {CAPS[cap].label}{" "}
              <span className="faint" style={{ fontSize: 11.5 }}>
                — {CAPS[cap].desc}
              </span>
            </span>
            <span className={`chip ${riskTone(CAPS[cap].risk)}`}>
              {CAPS[cap].risk === "high" ? "عالية" : CAPS[cap].risk === "mid" ? "متوسطة" : "منخفضة"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
