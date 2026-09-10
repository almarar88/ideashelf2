"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { APPS } from "@/lib/nova/apps";
import { SYSCALLS } from "@/lib/nova/syscalls";
import { iconOf, nameOf, useNova } from "./kernel-context";

/* ══════════════════════════════════════════════════════════
   شريط النية — الواجهة الأساسية للنظام
   لا قوائم ولا تفرّع: تكتب ما تريد، والنواة تتكفّل بالباقي.
   ══════════════════════════════════════════════════════════ */

const SUGGESTIONS = [
  "رتّب النوافذ شبكة",
  "اصنع تطبيقًا لمتابعة شرب الماء",
  "ابحث عن المزرعة",
  "وضع ليلي بلون سماوي",
  "أطلق وكيلًا يجهّز تقرير الربع",
  "افتح الصدفة",
];

export function IntentBar({ onClose }: { onClose: () => void }) {
  const { submit, busy, lastPlan, neural, model } = useNova();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setText("");
    const plan = await submit(v);
    // النوايا المعرفية تُبقي الشريط ليقرأ المستخدم الجواب؛ الأوامر تُغلقه
    if (plan && plan.calls.length > 0) onClose();
  };

  return (
    <div className="intent glass" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row">
        <span className="accent" style={{ fontSize: 18 }}>
          ◈
        </span>
        <input
          ref={inputRef}
          className="intent-input"
          placeholder="قل ما تريد… لا أوامر تُحفظ، فقط نيّتك"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(text);
            if (e.key === "Escape") onClose();
          }}
        />
        <span className={`chip ${neural ? "on" : "warn"}`}>{neural ? "العصب" : "الانعكاس"}</span>
      </div>

      {busy && (
        <div className="thinking">
          <i />
          <i />
          <i />
          <span>{neural ? `${model} يخطّط…` : "طبقة الانعكاس تحلّل…"}</span>
        </div>
      )}

      {!busy && lastPlan && (
        <div className="mono faint ltr" style={{ marginTop: 8, lineHeight: 1.9 }}>
          {lastPlan.calls.length === 0
            ? "— بلا نداءات: جواب فقط"
            : lastPlan.calls.map((c, i) => (
                <div key={i}>
                  → {c.op} {JSON.stringify(c.args ?? {})}
                </div>
              ))}
          <div style={{ marginTop: 4 }}>
            {lastPlan.source === "neural" ? "خُطّط عصبيًا" : "خُطّط انعكاسيًا"} · {lastPlan.latency}ms
          </div>
        </div>
      )}

      <div className="sugg">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => void send(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   الشريط العلوي
   ══════════════════════════════════════════════════════════ */

export function TopBar({
  onIntent,
  onBell,
}: {
  onIntent: () => void;
  onBell: () => void;
}) {
  const { state, neural, run } = useNova();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    tick();
    const id = window.setInterval(tick, 10000);
    return () => window.clearInterval(id);
  }, []);

  const unread = state.notifications.filter((n) => !n.read).length;
  const running = state.agents.filter((a) => a.state === "running").length;

  return (
    <div className="topbar glass">
      <b className="accent">NOVA</b>
      <span className="pill" onClick={onIntent} title="Ctrl + K">
        <span className="faint">⌘</span> نيّة جديدة
      </span>
      <span className="pill" title={neural ? "طبقة العصب متصلة" : "طبقة الانعكاس المحلية"}>
        <i className={`led ${neural ? "" : "reflex"}`} />
        {neural ? "عصب" : "انعكاس"}
      </span>
      {running > 0 && (
        <span className="pill" onClick={() => run({ op: "win.open", args: { app: "monitor" } })}>
          ◎ {running} وكيل
        </span>
      )}
      <div className="grow" />
      <span className="faint mono">{state.seq} نداء</span>
      <span className="pill" onClick={onBell}>
        ◔ {unread > 0 ? unread : ""}
      </span>
      <span className="pill" onClick={() => run({ op: "power", args: { action: "lock" } })}>
        ⏏ قفل
      </span>
      <span>{clock}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   الشريط السفلي
   ══════════════════════════════════════════════════════════ */

export function Dock({ onIntent }: { onIntent: () => void }) {
  const { state, run } = useNova();

  const openMap = useMemo(() => {
    const m = new Map<string, string>();
    state.windows.forEach((w) => m.set(w.app, w.id));
    return m;
  }, [state.windows]);

  const toggle = (app: string) => {
    const id = openMap.get(app);
    if (!id) return run({ op: "win.open", args: { app } });
    const win = state.windows.find((w) => w.id === id);
    if (win?.minimized || state.focus !== id) return run({ op: "win.focus", args: { id } });
    return run({ op: "win.minimize", args: { id } });
  };

  return (
    <div className="dock glass">
      <button className="dock-item" onClick={onIntent} title="شريط النية">
        <span className="accent">◈</span>
        <span className="tip">نيّة جديدة · Ctrl+K</span>
      </button>
      <span className="dock-sep" />
      {APPS.map((a) => (
        <button
          key={a.key}
          className={`dock-item ${openMap.has(a.key) ? "live" : ""}`}
          onClick={() => toggle(a.key)}
        >
          {a.icon}
          <span className="tip">
            {a.name} — {a.hint}
          </span>
        </button>
      ))}
      {state.composed.length > 0 && <span className="dock-sep" />}
      {state.composed.map((c) => (
        <button
          key={c.id}
          className={`dock-item made ${openMap.has(c.id) ? "live" : ""}`}
          onClick={() => toggle(c.id)}
        >
          {c.icon}
          <span className="tip">{c.name} — تطبيق مولّد</span>
        </button>
      ))}
      <span className="dock-sep" />
      <button
        className="dock-item"
        onClick={() => run({ op: "win.arrange", args: { mode: "grid" } })}
        title="ترتيب"
      >
        ▦<span className="tip">رتّب سطح المكتب</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   الإشعارات
   ══════════════════════════════════════════════════════════ */

/**
 * الإشعارات العابرة تُدار بالحركة وحدها: تظهر ثم تختفي بـ CSS.
 * لا مؤقّتات ولا قراءة للوقت أثناء التصيير — العنصر يُركّب مرة واحدة بمعرّفه
 * فيؤدي دورة حياته، والقائمة تُضاف من الأعلى فقط فلا يُعاد تشغيل أي دورة.
 */
export function Toasts() {
  const { state } = useNova();
  const latest = state.notifications.slice(0, 4);
  if (latest.length === 0) return null;

  return (
    <div className="toast-wrap">
      {latest.map((n) => (
        <div key={n.id} className={`toast glass ${n.level} ephemeral`}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{n.title}</div>
          {n.body && (
            <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>
              {n.body}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function NotifCenter({ onClose }: { onClose: () => void }) {
  const { state, run } = useNova();
  return (
    <div className="notif-center glass" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ padding: "2px 4px 8px" }}>
        <b style={{ fontSize: 12.5 }}>مركز الإشعارات</b>
        <div className="grow" />
        <button className="btn ghost tiny" onClick={onClose}>
          إخفاء
        </button>
      </div>
      <div className="scroll" style={{ maxHeight: 320, display: "flex", flexDirection: "column", gap: 6 }}>
        {state.notifications.length === 0 && <div className="empty">لا إشعارات</div>}
        {state.notifications.map((n) => (
          <div key={n.id} className={`toast glass ${n.level}`} style={{ width: "100%" }}>
            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{n.title}</div>
            {n.body && (
              <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>
                {n.body}
              </div>
            )}
            <div className="faint mono" style={{ marginTop: 4 }}>
              {new Date(n.at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
      <div className="hr" />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn tiny" onClick={() => run({ op: "win.open", args: { app: "monitor" } })}>
          المراقب
        </button>
        <button className="btn tiny" onClick={() => run({ op: "win.open", args: { app: "rules" } })}>
          القواعد
        </button>
        <button className="btn tiny" onClick={() => run({ op: "win.arrange", args: { mode: "focus" } })}>
          تركيز
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   الإقلاع والقفل
   ══════════════════════════════════════════════════════════ */

const BOOT_LINES: [string, string][] = [
  ["nova kernel 1.0 · syscall-driven", "جاهزة"],
  // العدد يُقرأ من الجدول نفسه: لا رقم مكتوب باليد يتخلّف عن الكود
  ["جدول نداءات النظام", `${Object.keys(SYSCALLS).length} نداء`],
  ["نظام الملفات الدلالي", "مُثبّت"],
  ["مفسّر الواجهات المعلنة", "آمن"],
  ["طبقة الانعكاس المحلية", "تعمل"],
  ["طبقة العصب", "فحص…"],
  ["القواعد الذكية", "نشطة"],
];

export function BootScreen({ neural }: { neural: boolean }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setN((v) => Math.min(BOOT_LINES.length, v + 1)), 300);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="boot">
      <div className="boot-inner">
        <div className="boot-mark">NOVA</div>
        <div className="mono boot-log">
          {BOOT_LINES.slice(0, n).map(([label, val], i) => (
            <div className="boot-line" key={label} style={{ animationDelay: `${i * 40}ms` }}>
              <span>{label}</span>
              <b>{label === "طبقة العصب" ? (neural ? "متصلة" : "غائبة — الانعكاس يكفي") : val}</b>
            </div>
          ))}
        </div>
        <div className="boot-bar">
          <i style={{ width: `${(n / BOOT_LINES.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function LockScreen() {
  const { state, run } = useNova();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lock" onDoubleClick={() => run({ op: "power", args: { action: "unlock" } }, "user")}>
      <div className="lock-card glass">
        <div className="lock-clock">{clock}</div>
        <div className="dim" style={{ marginTop: 8 }}>
          {state.user.name}
        </div>
        <button
          className="btn primary"
          style={{ marginTop: 20 }}
          onClick={() => run({ op: "power", args: { action: "unlock" } }, "user")}
        >
          دخول
        </button>
        <div className="faint" style={{ marginTop: 12, fontSize: 12 }}>
          {state.windows.length} نافذة محفوظة · {state.fs.length} عنصر
        </div>
      </div>
    </div>
  );
}

export function AppChrome({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="row" style={{ padding: "10px 12px 0" }}>
      <h3 className="grow">{title}</h3>
      {actions}
    </div>
  );
}

export function iconFor(app: string) {
  return APPS.find((a) => a.key === app)?.icon ?? "▣";
}

export { nameOf, iconOf };
