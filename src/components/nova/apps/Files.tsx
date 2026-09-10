"use client";

import { useMemo, useState } from "react";
import { searchFs } from "@/lib/nova/fs";
import { useNova } from "../kernel-context";
import type { NovaWindow } from "@/lib/nova/types";

/** المحتوى: لا شجرة مجلدات تُتنقّل، بل استعلام واحد ووسوم. */
export default function Files({ win }: { win: NovaWindow }) {
  const { state, run } = useNova();
  const [q, setQ] = useState(String(win.props.query ?? ""));
  const [sel, setSel] = useState<string | null>(null);

  const results = useMemo(() => (q.trim() ? searchFs(state.fs, q) : state.fs), [q, state.fs]);
  const current = results.find((f) => f.id === sel) ?? results[0];

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    state.fs.forEach((f) => f.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [state.fs]);

  return (
    <div className="app" style={{ flexDirection: "row", gap: 0, padding: 0 }}>
      <div className="col" style={{ width: "46%", minWidth: 200, borderInlineEnd: "1px solid rgb(var(--line) / .1)" }}>
        <div style={{ padding: 10 }}>
          <input
            className="field"
            placeholder="ابحث بالمعنى: مزرعة، ميزانية، وكيل…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="row" style={{ flexWrap: "wrap", marginTop: 8, gap: 5 }}>
            {allTags.map(([t, c]) => (
              <button
                key={t}
                className={`chip ${q === t ? "on" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setQ(q === t ? "" : t)}
              >
                {t} <span className="faint">{c}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="scroll grow" style={{ padding: "0 8px 10px" }}>
          {results.length === 0 && <div className="empty">لا نتائج لـ «{q}»</div>}
          {results.map((f) => (
            <div
              key={f.id}
              className={`list-row ${current?.id === f.id ? "sel" : ""}`}
              onClick={() => setSel(f.id)}
            >
              <span className="faint">{f.mime === "text/markdown" ? "◈" : "▤"}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.path}
                </div>
                <div className="faint" style={{ fontSize: 11 }}>
                  {f.author} · {f.tags.slice(0, 3).join(" · ") || "بلا وسوم"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col grow" style={{ minWidth: 0 }}>
        {!current ? (
          <div className="empty">اختر عنصرًا</div>
        ) : (
          <>
            <div className="row" style={{ padding: 10 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{current.path}</div>
                <div className="faint" style={{ fontSize: 11 }}>
                  {new Date(current.updatedAt).toLocaleString("ar")} · {current.content.length} حرفًا
                </div>
              </div>
              <button
                className="btn tiny"
                onClick={() => run({ op: "win.open", args: { app: "notes", props: { path: current.path } } })}
              >
                تحرير
              </button>
              <button
                className="btn tiny"
                onClick={() => run({ op: "clipboard.set", args: { text: current.content } })}
              >
                نسخ
              </button>
              <button
                className="btn tiny"
                style={{ color: "var(--danger)" }}
                onClick={() => run({ op: "fs.delete", args: { path: current.path } })}
              >
                حذف
              </button>
            </div>
            <div className="hr" style={{ margin: 0 }} />
            <div className="scroll grow app-pad" style={{ whiteSpace: "pre-wrap", lineHeight: 1.85 }}>
              {current.content || <span className="faint">فارغ</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
