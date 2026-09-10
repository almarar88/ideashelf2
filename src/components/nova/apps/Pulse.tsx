"use client";

import { useEffect, useState } from "react";
import type { FarmPulse } from "@/lib/nova/bridge";
import { fetchPulse } from "@/lib/nova/pulse-client";
import { useNova } from "../kernel-context";

const money = (n: number) => Math.round(n).toLocaleString("ar-SA");

/**
 * المزرعة: نبضة البيانات الحقيقية داخل نوفا.
 * هذه النافذة هي البرهان على أن نوفا نظام تشغيل *لمنتج قائم*، لا عرض منفصل:
 * الأرقام هنا هي أرقام قاعدة بيانات التطبيق، ونفسها تُغذّي إجابات الذكاء.
 */
export default function Pulse() {
  const { run, neural, ask } = useNova();
  const [pulse, setPulse] = useState<FarmPulse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [advice, setAdvice] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const [tick, setTick] = useState(0);

  // الجلب اشتراك على نظام خارجي (الخادم): ضبط الحالة يحدث في رد النداء لا في متن الأثر
  useEffect(() => {
    let alive = true;
    fetchPulse().then((p) => {
      if (!alive) return;
      setPulse(p);
      setState(p ? "ready" : "empty");
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  const refresh = () => {
    setState("loading");
    setTick((t) => t + 1);
  };

  const analyse = async () => {
    if (!pulse) return;
    setThinking(true);
    const answer = await ask(
      "أنت مستشار زراعي وإداري. من أرقام المزرعة التالية: ما أهم ثلاث ملاحظات، وما الخطوة العملية التالية؟ كن محددًا وأشر إلى الأرقام. إن كانت البيانات ناقصة فقل ذلك.",
      JSON.stringify(pulse)
    );
    setThinking(false);
    setAdvice(
      answer ??
        "طبقة العصب غير متاحة. أضف ANTHROPIC_API_KEY ليحلّل Claude هذه الأرقام. الأرقام نفسها أعلاه حقيقية بلا مفتاح."
    );
  };

  if (state === "loading") {
    return (
      <div className="empty">
        <div className="thinking">
          <i />
          <i />
          <i />
        </div>
        <div>تُقرأ نبضة المزرعة…</div>
      </div>
    );
  }

  if (state === "empty" || !pulse) {
    return (
      <div className="empty">
        <div style={{ fontSize: 26 }}>◉</div>
        <div>لا بيانات مزرعة متاحة</div>
        <div className="faint" style={{ fontSize: 12, maxWidth: 340, lineHeight: 1.8 }}>
          قاعدة البيانات غير مهيّأة أو فارغة. نوفا تعمل كاملة بدونها، لكن هذه النافذة
          تحتاج بيانات التطبيق الحقيقية.
        </div>
        <button className="btn tiny" onClick={refresh}>
          أعد المحاولة
        </button>
      </div>
    );
  }

  const p = pulse;
  const sickRatio = p.palms.total ? Math.round(((p.palms.sick + p.palms.treatment) / p.palms.total) * 100) : 0;
  const maxCat = Math.max(1, ...p.money.byCategory.map((c) => c.value));

  return (
    <div className="app scroll">
      <div className="row">
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{p.farm?.name ?? "المزرعة"}</div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            {p.farm?.address ?? "بلا عنوان"}
            {p.farm?.areaHectares ? ` · ${p.farm.areaHectares} هكتار` : ""} · حُدّثت{" "}
            {new Date(p.generatedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <button className="btn tiny" onClick={refresh}>
          تحديث
        </button>
        <button className="btn tiny" onClick={() => run({ op: "farm.report", args: {} })}>
          اكتب تقريرًا
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        {[
          { label: "النخيل", value: money(p.palms.total), hint: `${p.palms.healthy} سليمة`, tone: "var(--ink)" },
          { label: "تحتاج تدخّلًا", value: money(p.palms.sick + p.palms.treatment), hint: `${sickRatio}% من الإجمالي`, tone: sickRatio > 15 ? "var(--danger)" : "var(--warn)" },
          { label: "عمال نشطون", value: money(p.workers.active), hint: `رواتب ${money(p.workers.payroll)}`, tone: "var(--ink)" },
          { label: "مصاريف الشهر", value: money(p.money.monthTotal), hint: `السنة ${money(p.money.yearTotal)}`, tone: "var(--accent)" },
        ].map((k) => (
          <div key={k.label} className="card">
            <div className="faint" style={{ fontSize: 11 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 200, color: k.tone }}>{k.value}</div>
            <div className="faint" style={{ fontSize: 11 }}>
              {k.hint}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
        <div className="card">
          <h4 style={{ marginBottom: 9 }}>المصاريف بالبند (هذه السنة)</h4>
          {p.money.byCategory.length === 0 && <div className="faint">لا مصاريف مسجّلة</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {p.money.byCategory.map((c) => (
              <div key={c.label}>
                <div className="row" style={{ fontSize: 11.5, justifyContent: "space-between" }}>
                  <span className="dim">{c.label}</span>
                  <span className="mono ltr">{money(c.value)}</span>
                </div>
                <div className="bar-track">
                  <i style={{ width: `${(c.value / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 9 }}>حالة النخيل</h4>
          <div className="kv">
            <span className="dim">سليمة</span>
            <span style={{ color: "var(--ok)" }}>{p.palms.healthy}</span>
          </div>
          <div className="kv">
            <span className="dim">مريضة</span>
            <span style={{ color: "var(--danger)" }}>{p.palms.sick}</span>
          </div>
          <div className="kv">
            <span className="dim">تحت العلاج</span>
            <span style={{ color: "var(--warn)" }}>{p.palms.treatment}</span>
          </div>
          <div className="kv">
            <span className="dim">فسائل</span>
            <span>{p.palms.young}</span>
          </div>
          <div className="kv">
            <span className="dim">تشخيصات مفتوحة</span>
            <span>{p.health.openDiagnoses}</span>
          </div>
          <div className="row" style={{ flexWrap: "wrap", marginTop: 8, gap: 5 }}>
            {p.varieties.map((v) => (
              <span key={v.label} className="chip">
                {v.label} {v.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h4 className="grow">تحليل الأرقام</h4>
          <button className="btn tiny" onClick={() => void analyse()} disabled={thinking}>
            {thinking ? "يحلّل…" : neural ? "حلّل بالعصب" : "حلّل (يحتاج مفتاحًا)"}
          </button>
        </div>
        {advice ? (
          <p className="dim" style={{ fontSize: 12.5, marginTop: 8, whiteSpace: "pre-wrap" }}>
            {advice}
          </p>
        ) : (
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            الأرقام أعلاه تُقرأ من قاعدة بيانات التطبيق. اطلب التحليل ليقرأها Claude ويقترح خطوة.
          </div>
        )}
      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>
        <span className="dim" style={{ fontSize: 12 }}>
          اذهب إلى الشاشة الكاملة:
        </span>
        {[
          ["/palms", "النخيل"],
          ["/farm", "الخريطة"],
          ["/expenses", "المصاريف"],
          ["/workers", "العمال"],
          ["/market", "السوق"],
          ["/auctions", "المزادات"],
        ].map(([route, label]) => (
          <button
            key={route}
            className="chip"
            style={{ cursor: "pointer" }}
            onClick={() => run({ op: "nav.open", args: { route } })}
          >
            {label} ↗
          </button>
        ))}
      </div>

      {p.events.length > 0 && (
        <div className="card">
          <h4 style={{ marginBottom: 7 }}>أقرب المواعيد</h4>
          {p.events.map((e, i) => (
            <div key={i} className="kv">
              <span className="dim">{e.title}</span>
              <span className="mono ltr">{e.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
