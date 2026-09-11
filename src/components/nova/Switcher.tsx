"use client";

import { iconOf, useNova } from "./kernel-context";

/** مبدّل النوافذ (Ctrl + `) — يعرض ما يعمل الآن بترتيب آخر استخدام */
export default function Switcher({ index }: { index: number }) {
  const { state } = useNova();
  const windows = state.windows.filter((w) => w.space === state.space).sort((a, b) => b.z - a.z);
  if (windows.length < 2) return null;

  return (
    <div className="switcher glass">
      {windows.map((w, i) => (
        <div key={w.id} className={`switcher-item ${i === index % windows.length ? "on" : ""}`}>
          <div className="ic">{iconOf(state, w.app)}</div>
          <div className="nm">{w.title}</div>
        </div>
      ))}
    </div>
  );
}
