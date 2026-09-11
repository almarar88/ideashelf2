"use client";

import { useEffect, useState } from "react";
import { APPS } from "@/lib/nova/apps";
import { CAPS } from "@/lib/nova/caps";
import { humanSize } from "@/lib/nova/fs";
import { SYSCALLS } from "@/lib/nova/syscalls";
import { storageInfo } from "@/lib/nova/store";
import { useNova } from "../kernel-context";

/**
 * عن النظام.
 *
 * ليست شاشة «حول» تجميلية: كل رقم فيها يُقرأ من الجداول والحالة الحقيقية
 * (عدد النداءات من جدولها، القدرات من جدولها، التخزين من المتصفح)، فلا يمكن
 * أن تتخلّف عن الكود أو تكذب.
 */
export default function About() {
  const { state, run, neural, model, edition } = useNova();
  const [storage, setStorage] = useState<{
    used: number;
    quota: number;
    where: string;
  } | null>(null);
  const [agent, setAgent] = useState<{
    ua: string;
    cores: number;
    mem: string;
    lang: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    storageInfo().then((info) => {
      if (alive) setStorage(info);
    });
    // قراءة معلومات الجهاز تُدفع إلى ما بعد الإطار: ضبطها في متن الأثر
    // يُسبّب تصييرًا متسلسلًا، وهي ليست عاجلة بأي معنى.
    const nav = navigator as Navigator & { deviceMemory?: number };
    const handle = window.requestAnimationFrame(() =>
      setAgent({
        ua: /Android/i.test(navigator.userAgent)
          ? "أندرويد"
          : /iPhone|iPad/i.test(navigator.userAgent)
            ? "iOS"
            : /Windows/i.test(navigator.userAgent)
              ? "ويندوز"
              : /Mac/i.test(navigator.userAgent)
                ? "macOS"
                : /Linux/i.test(navigator.userAgent)
                  ? "لينكس"
                  : "غير معروف",
        cores: navigator.hardwareConcurrency || 0,
        mem: nav.deviceMemory ? `${nav.deviceMemory} ج.ب` : "غير معلن",
        lang: navigator.language,
      }),
    );
    return () => {
      alive = false;
      window.cancelAnimationFrame(handle);
    };
  }, []);

  const fsBytes = state.fs.reduce(
    (sum, f) => sum + (f.size ?? f.content.length),
    0,
  );
  const okCalls = state.journal.filter((j) => j.ok).length;

  return (
    <div className="app scroll">
      <div className="card" style={{ textAlign: "center" }}>
        <div
          className="accent"
          style={{ fontSize: 30, letterSpacing: 10, fontWeight: 200 }}
        >
          NOVA
        </div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>
          نظام تشغيل تُقاد كل حالته بالنيّة
        </div>
        <div
          className="row"
          style={{ justifyContent: "center", marginTop: 9, flexWrap: "wrap" }}
        >
          <span className="chip">kernel 1.1</span>
          <span className="chip">
            {edition === "device" ? "نسخة الجهاز" : "نسخة الويب"}
          </span>
          <span className={`chip ${neural ? "on" : "warn"}`}>
            {neural ? model : "reflex/1.0"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 10,
        }}
      >
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>النواة</h4>
          <div className="kv">
            <span className="dim">نداءات النظام</span>
            <span className="mono ltr">{Object.keys(SYSCALLS).length}</span>
          </div>
          <div className="kv">
            <span className="dim">القدرات</span>
            <span className="mono ltr">{Object.keys(CAPS).length}</span>
          </div>
          <div className="kv">
            <span className="dim">نُفّذ بنجاح</span>
            <span className="mono ltr">
              {okCalls}/{state.journal.length}
            </span>
          </div>
          <div className="kv">
            <span className="dim">نقاط الرجوع</span>
            <span className="mono ltr">{state.journal.length}</span>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 8 }}>المساحة</h4>
          <div className="kv">
            <span className="dim">التطبيقات</span>
            <span className="mono ltr">
              {APPS.length} + {state.composed.length}
            </span>
          </div>
          <div className="kv">
            <span className="dim">الأسطح</span>
            <span className="mono ltr">{state.spaces.length}</span>
          </div>
          <div className="kv">
            <span className="dim">النوافذ</span>
            <span className="mono ltr">{state.windows.length}</span>
          </div>
          <div className="kv">
            <span className="dim">عناصر المحتوى</span>
            <span className="mono ltr">
              {state.fs.length} · {humanSize(fsBytes)}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 8 }}>التخزين</h4>
        {storage ? (
          <>
            <div className="kv">
              <span className="dim">المخزن</span>
              <span className="mono ltr">{storage.where}</span>
            </div>
            {storage.quota > 0 && (
              <>
                <div className="kv">
                  <span className="dim">المستخدم من الحصّة</span>
                  <span className="mono ltr">
                    {humanSize(storage.used)} / {humanSize(storage.quota)}
                  </span>
                </div>
                <div className="bar-track" style={{ marginTop: 7 }}>
                  <i
                    style={{
                      width: `${Math.min(100, (storage.used / storage.quota) * 100)}%`,
                    }}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="faint">تُقرأ…</div>
        )}
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 8 }}>الجهاز</h4>
        <div className="kv">
          <span className="dim">النظام المضيف</span>
          <span>{agent?.ua ?? "…"}</span>
        </div>
        <div className="kv">
          <span className="dim">أنوية المعالج</span>
          <span className="mono ltr">{agent?.cores || "غير معلن"}</span>
        </div>
        <div className="kv">
          <span className="dim">الذاكرة</span>
          <span className="mono ltr">{agent?.mem ?? "…"}</span>
        </div>
        <div className="kv">
          <span className="dim">اللغة</span>
          <span className="mono ltr">{agent?.lang ?? "…"}</span>
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 7 }}>المبدأ</h4>
        <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
          لا شيء في نوفا يغيّر الحالة إلا عبر نداء نظام مُعرَّف ومُتحقَّق منه.
          من هذا القيد الواحد يأتي كل ما تراه: سجل كامل، وإرجاع زمني حقيقي،
          وصلاحيات يمكن سحبها، وذكاء اصطناعي يقود النظام بصلاحياتك لا أكثر.
        </p>
        <div className="row" style={{ marginTop: 9, flexWrap: "wrap" }}>
          <button
            className="btn tiny"
            onClick={() => run({ op: "win.open", args: { app: "timeline" } })}
          >
            الخط الزمني
          </button>
          <button
            className="btn tiny"
            onClick={() => run({ op: "win.open", args: { app: "guard" } })}
          >
            الصلاحيات
          </button>
          <button
            className="btn tiny"
            onClick={() => run({ op: "win.open", args: { app: "monitor" } })}
          >
            المراقب
          </button>
        </div>
      </div>
    </div>
  );
}
