"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { iconOf, useNova } from "./kernel-context";
import type { NovaWindow } from "@/lib/nova/types";

type Snap = null | "start" | "end" | "top";

const MIN_W = 320;
const MIN_H = 200;
const EDGE = 28;

/**
 * إطار النافذة: السحب والتحجيم يحدثان محليًا أثناء الحركة،
 * ثم يُثبّتان بنداء نظام واحد عند الإفلات — حتى لا يمتلئ السجل
 * بمئات القيود ويظل الإرجاع الزمني نظيفًا وقابلًا للقراءة.
 */
export default function WindowFrame({
  win,
  children,
}: {
  win: NovaWindow;
  children: React.ReactNode;
}) {
  const { state, run, desk } = useNova();
  const [live, setLive] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [snap, setSnap] = useState<Snap>(null);
  const mode = useRef<"move" | "size-s" | "size-e" | null>(null);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  const focused = state.focus === win.id;
  const box = live ?? { x: win.x, y: win.y, w: win.w, h: win.h };

  const start = useCallback(
    (e: React.PointerEvent, kind: "move" | "size-s" | "size-e") => {
      if (win.maximized && kind !== "move") return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      mode.current = kind;
      origin.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
      if (!focused) run({ op: "win.focus", args: { id: win.id } }, "user");
    },
    [focused, run, win.h, win.id, win.maximized, win.w, win.x, win.y]
  );

  useEffect(() => {
    if (!mode.current) return undefined;

    const move = (e: PointerEvent) => {
      const o = origin.current;
      const dx = e.clientX - o.px;
      const dy = e.clientY - o.py;

      if (mode.current === "move") {
        const nx = Math.min(Math.max(-o.w + 90, o.x + dx), desk.w - 70);
        const ny = Math.min(Math.max(0, o.y + dy), desk.h - 46);
        setLive({ x: nx, y: ny, w: o.w, h: o.h });
        setSnap(
          e.clientY < EDGE ? "top" : e.clientX < EDGE ? "start" : e.clientX > window.innerWidth - EDGE ? "end" : null
        );
      } else if (mode.current === "size-e") {
        setLive({ x: o.x, y: o.y, w: Math.max(MIN_W, o.w + dx), h: Math.max(MIN_H, o.h + dy) });
      } else {
        const w = Math.max(MIN_W, o.w - dx);
        setLive({ x: o.x + (o.w - w), y: o.y, w, h: Math.max(MIN_H, o.h + dy) });
      }
    };

    const up = () => {
      const snapped = snap;
      const cur = live;
      mode.current = null;
      setSnap(null);
      setLive(null);
      if (snapped) {
        const half = Math.floor(desk.w / 2);
        if (snapped === "top") run({ op: "win.maximize", args: { id: win.id } });
        else
          run({
            op: "win.move",
            args: {
              id: win.id,
              x: snapped === "start" ? 0 : desk.w - half,
              y: 0,
              w: half,
              h: desk.h - 8,
            },
          });
        return;
      }
      if (cur) run({ op: "win.move", args: { id: win.id, ...cur } });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [desk.h, desk.w, live, run, snap, win.id]);

  if (win.minimized) return null;

  const geo = win.maximized
    ? { left: 0, top: 0, width: desk.w, height: desk.h - 4 }
    : { left: box.x, top: box.y, width: box.w, height: box.h };

  const half = Math.floor(desk.w / 2);
  const hint =
    snap === "top"
      ? { left: 0, top: 0, width: desk.w, height: desk.h - 4 }
      : snap
      ? { left: snap === "start" ? 0 : desk.w - half, top: 0, width: half, height: desk.h - 8 }
      : null;

  return (
    <>
      {hint && <div className="snap-hint" style={hint} />}
      <div
        className={`nwin ${focused ? "focused" : ""}`}
        style={{ ...geo, zIndex: win.z }}
        onPointerDown={() => {
          if (!focused) run({ op: "win.focus", args: { id: win.id } });
        }}
      >
        <div
          className="nwin-bar"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            start(e, "move");
          }}
          onDoubleClick={() => run({ op: "win.maximize", args: { id: win.id } })}
        >
          <div className="nwin-dots">
            <button
              className="dot x"
              title="إغلاق"
              onClick={() => run({ op: "win.close", args: { id: win.id } })}
            />
            <button
              className="dot m"
              title="تصغير"
              onClick={() => run({ op: "win.minimize", args: { id: win.id } })}
            />
            <button
              className="dot z"
              title="تكبير"
              onClick={() => run({ op: "win.maximize", args: { id: win.id } })}
            />
          </div>
          <span className="nwin-icon">{iconOf(state, win.app)}</span>
          <span className="nwin-title grow">{win.title}</span>
          {win.app.startsWith("app_") && <span className="chip on">مولّد</span>}
        </div>

        <div className="nwin-body">{children}</div>

        {!win.maximized && (
          <>
            <div className="nwin-grip" onPointerDown={(e) => start(e, "size-s")} />
            <div className="nwin-grip e" onPointerDown={(e) => start(e, "size-e")} />
          </>
        )}
      </div>
    </>
  );
}
