"use client";

import { APPS } from "@/lib/nova/apps";
import type { SyscallCall } from "@/lib/nova/types";
import { useNova } from "./kernel-context";

type Item = { label: string; call: SyscallCall; keys?: string };

/**
 * قائمة السياق على سطح المكتب.
 * كل عنصر فيها ليس اختصارًا لدالة داخلية بل **نداء نظام** — نفس الذي يصدره
 * شريط النيّة والصدفة والذكاء. لهذا تُسجّل نقرات القائمة في السجل ويمكن
 * الرجوع عنها، وهو ما لا يتحقّق لو ربطنا القائمة بمنطق خاص.
 */
export default function ContextMenu({
  x,
  y,
  onClose,
}: {
  x: number;
  y: number;
  onClose: () => void;
}) {
  const { state, run } = useNova();

  const items: (Item | "sep")[] = [
    { label: "نبضة المزرعة", call: { op: "farm.pulse", args: {} } },
    { label: "شريط النيّة", call: { op: "win.open", args: { app: "oracle" } }, keys: "Ctrl+K" },
    { label: "المشغل — اصنع تطبيقًا", call: { op: "win.open", args: { app: "studio" } } },
    "sep",
    { label: "رتّب شبكة", call: { op: "win.arrange", args: { mode: "grid" } }, keys: "Ctrl+J" },
    { label: "رتّب نصفين", call: { op: "win.arrange", args: { mode: "split" } }, keys: "Ctrl+←" },
    { label: "وضع التركيز", call: { op: "power", args: { action: "zen" } } },
    { label: "صغّر الكل", call: { op: "win.minimize", args: { all: true } } },
    { label: "أغلق الكل", call: { op: "win.close", args: { all: true } } },
    "sep",
    {
      label: state.theme.mode === "night" ? "وضع الفجر" : "وضع الليل",
      call: { op: "theme.set", args: { mode: state.theme.mode === "night" ? "dawn" : "night" } },
    },
    { label: "الخط الزمني", call: { op: "win.open", args: { app: "timeline" } } },
    { label: "قفل الجلسة", call: { op: "power", args: { action: "lock" } }, keys: "Ctrl+⇧L" },
  ];

  // القائمة لا تتجاوز حدود الشاشة
  const left = Math.min(x, window.innerWidth - 224);
  const top = Math.min(y, window.innerHeight - 420);

  return (
    <div className="ctx glass" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) =>
        it === "sep" ? (
          <div key={`s${i}`} className="ctx-sep" />
        ) : (
          <button
            key={it.label}
            className="ctx-item"
            onClick={() => {
              run(it.call);
              onClose();
            }}
          >
            <span>{it.label}</span>
            {it.keys && <span className="k">{it.keys}</span>}
          </button>
        )
      )}
      <div className="ctx-sep" />
      <div className="faint" style={{ fontSize: 11, padding: "3px 9px 5px" }}>
        {APPS.length} تطبيقًا مثبّتًا · {state.composed.length} مولّدًا
      </div>
    </div>
  );
}
