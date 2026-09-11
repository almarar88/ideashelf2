"use client";

import { useEffect, useState } from "react";
import { useNova } from "../kernel-context";
import type { NovaWindow } from "@/lib/nova/types";

/**
 * الساعة والمؤقّت.
 *
 * المؤقّت هنا ليس عدّادًا معزولًا في مكوّن: عند انتهائه يُصدر **نداء نظام**
 * (إشعار)، فيظهر في مركز الإشعارات ويُسجّل في السجل كأي حدث آخر. هذا هو
 * الفرق بين تطبيق داخل نظام وتطبيق بجانبه.
 */
export default function Clock({ win }: { win: NovaWindow }) {
  const { run, state } = useNova();
  const requested = Number(win.props.minutes);
  const [now, setNow] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(
    Number.isFinite(requested) && requested > 0 ? Math.min(180, requested) * 60 : 0
  );
  const [running, setRunning] = useState(false);
  const [minutes, setMinutes] = useState(Number.isFinite(requested) && requested > 0 ? Math.min(180, requested) : 5);
  const [label, setLabel] = useState("");

  // الوقت نظام خارجي: نشترك عليه ولا نقرأه أثناء التصيير
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          // النداء يخرج من مؤقّت لا من تصيير: مسار مسموح
          run({
            op: "notify",
            args: {
              title: label.trim() ? `انتهى: ${label.trim()}` : "انتهى المؤقّت",
              body: `${minutes} دقيقة`,
              level: "ok",
            },
          });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [label, minutes, run, running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const zones: [string, string][] = [
    ["الرياض", "Asia/Riyadh"],
    ["القاهرة", "Africa/Cairo"],
    ["لندن", "Europe/London"],
    ["طوكيو", "Asia/Tokyo"],
  ];

  return (
    <div className="app">
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 200, letterSpacing: 1, lineHeight: 1.1 }}>
          {now
            ? now.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
            : "--:--:--"}
        </div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>
          {now ? now.toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 9 }}>مؤقّت</h4>
        <div style={{ fontSize: 34, fontWeight: 200, textAlign: "center", direction: "ltr" }} className="mono">
          {mm}:{ss}
        </div>
        <input
          className="field"
          style={{ marginTop: 8 }}
          placeholder="لماذا؟ (يظهر في الإشعار)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {Array.from(new Set([1, 3, 5, 10, 25, minutes])).sort((a, b) => a - b).map((m) => (
            <button
              key={m}
              className={`chip ${minutes === m ? "on" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setMinutes(m);
                setRemaining(m * 60);
                setRunning(false);
              }}
            >
              {m} د
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 9 }}>
          <button
            className="btn primary"
            onClick={() => {
              if (remaining === 0) setRemaining(minutes * 60);
              setRunning(true);
            }}
            disabled={running}
          >
            ابدأ
          </button>
          <button className="btn" onClick={() => setRunning(false)} disabled={!running}>
            أوقف
          </button>
          <button
            className="btn"
            onClick={() => {
              setRunning(false);
              setRemaining(0);
            }}
          >
            صفّر
          </button>
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 7 }}>مناطق زمنية</h4>
        {zones.map(([name, tz]) => (
          <div key={tz} className="kv">
            <span className="dim">{name}</span>
            <span className="mono ltr">
              {now ? now.toLocaleTimeString("ar", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
            </span>
          </div>
        ))}
      </div>

      <div className="faint" style={{ fontSize: 11.5 }}>
        عند انتهاء المؤقّت يُصدر النظام إشعارًا مُسجّلًا في السجل — لا تنبيهًا
        يعيش داخل هذه النافذة. الإشعارات المعلّقة الآن: {state.notifications.length}
      </div>
    </div>
  );
}
