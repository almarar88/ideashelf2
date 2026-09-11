"use client";

import { useEffect, useRef, useState } from "react";
import { useNova } from "../kernel-context";

const COLORS = ["#e7e9f5", "#7c5cff", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#ec4899", "#0b0b14"];

/**
 * الرسّام.
 *
 * يختم ملفًا حقيقيًا: الحفظ يحوّل اللوحة إلى PNG ويكتبه في المحتوى بنداء
 * `fs.write`. أي أن اللوحة تصبح ملفًا كاملًا في النظام — يُعرض في «المحتوى»،
 * ويُصدَّر إلى قرصك، ويعود بالإرجاع الزمني مثل أي شيء آخر.
 * هذا هو معنى أن تكون التطبيقات *داخل* نظام لا بجانبه.
 */
export default function Paint() {
  const { run } = useNova();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(4);
  const [erasing, setErasing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [name, setName] = useState("رسمة");

  // تهيئة اللوحة بخلفية معتمة: PNG شفاف يبدو مكسورًا عند التصدير
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(240, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#11121c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = erasing ? "#11121c" : color;
    ctx.lineWidth = erasing ? size * 3 : size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#11121c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // PNG حقيقي: نفس ما يفهمه «المحتوى» والتصدير والمعرض
    const dataUrl = canvas.toDataURL("image/png");
    const safe = name.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "رسمة";
    run({
      op: "fs.write",
      args: {
        path: `/بيتي/رسوم/${safe}.png`,
        content: dataUrl,
        tags: ["رسم", "صورة"],
      },
    });
    setDirty(false);
  };

  return (
    <div className="app">
      <div className="row" style={{ flexWrap: "wrap" }}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${!erasing && color === c ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => {
              setColor(c);
              setErasing(false);
            }}
            title={c}
          />
        ))}
        <button className={`btn tiny ${erasing ? "primary" : ""}`} onClick={() => setErasing((v) => !v)}>
          ممحاة
        </button>
        <input
          type="range"
          min={1}
          max={24}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: 84 }}
          title="سماكة"
        />
        <span className="faint mono ltr">{size}px</span>
      </div>

      <canvas
        ref={canvasRef}
        className="paint-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          // نقطة واحدة يجب أن تترك أثرًا أيضًا
          stroke(last.current, { x: last.current.x + 0.01, y: last.current.y });
          setDirty(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const next = point(e);
          stroke(last.current, next);
          last.current = next;
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
        onPointerLeave={() => {
          drawing.current = false;
          last.current = null;
        }}
      />

      <div className="row">
        <input className="field grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الرسمة" />
        <button className="btn primary" onClick={save} disabled={!dirty}>
          {dirty ? "احفظ كصورة" : "محفوظ"}
        </button>
        <button className="btn" onClick={clear}>
          لوحة جديدة
        </button>
      </div>
      <div className="faint" style={{ fontSize: 11.5 }}>
        يُحفظ في <span className="mono ltr">/بيتي/رسوم</span> كملف PNG حقيقي — يظهر في
        «المحتوى»، ويمكن تصديره إلى قرصك.
      </div>
    </div>
  );
}
