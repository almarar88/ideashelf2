"use client";

import { useState } from "react";
import { interpolate, type AppSpec, type SpecAction, type SpecNode } from "@/lib/nova/spec";
import { useNova } from "./kernel-context";

/**
 * مفسّر الواجهات المعلنة.
 *
 * هذا هو الحدّ الفاصل بين «الذكاء يصنع تطبيقًا» و«الذكاء ينفّذ كودًا»:
 * ما يصل إلى هنا بيانات مُتحقّق منها بمخطط، لا سكربت. لا eval ولا Function،
 * والأزرار لا تستطيع فعل شيء إلا عبر نداءات النظام التي يملكها المستخدم أصلًا.
 */

type Local = Record<string, string | number | boolean | string[]>;

const toneVar: Record<string, string> = {
  default: "var(--ink)",
  accent: "var(--accent)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  muted: "var(--ink-dim)",
};

const sizePx: Record<string, number> = { xs: 11.5, sm: 12.5, md: 14, lg: 18, xl: 26 };

export default function SpecRenderer({ spec }: { spec: AppSpec }) {
  const { run } = useNova();
  const [local, setLocal] = useState<Local>(() => ({ ...(spec.state ?? {}) }) as Local);

  const act = (a?: SpecAction) => {
    if (!a) return;
    setLocal((prev) => {
      const next = { ...prev };
      if (a.set) next[a.set.key] = a.set.value;
      if (a.inc) next[a.inc.key] = (Number(next[a.inc.key] ?? 0) || 0) + a.inc.by;
      if (a.push) {
        const value = String(next[a.push.from] ?? "").trim();
        if (value) {
          const list = Array.isArray(next[a.push.list]) ? (next[a.push.list] as string[]) : [];
          next[a.push.list] = [value, ...list].slice(0, 60);
          next[a.push.from] = "";
        }
      }
      if (a.clear) next[a.clear] = Array.isArray(next[a.clear]) ? [] : "";
      return next;
    });
    // النداء يمر على حاجز التحقق نفسه الذي يمر عليه أي طلب من المستخدم
    if (a.run?.op) run({ op: a.run.op, args: a.run.args }, "neural");
  };

  const txt = (v: string) => interpolate(v, local);

  const draw = (node: SpecNode, key: string): React.ReactNode => {
    const n = node as Record<string, never> & { t: string };
    switch (n.t) {
      case "stack": {
        const kids = (n.children as unknown as SpecNode[]) ?? [];
        return (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: (n.dir as unknown as string) === "row" ? "row" : "column",
              gap: (n.gap as unknown as number) ?? 10,
              flexWrap: n.wrap ? "wrap" : "nowrap",
              alignItems: (n.dir as unknown as string) === "row" ? "center" : "stretch",
            }}
          >
            {kids.map((c, i) => draw(c, `${key}.${i}`))}
          </div>
        );
      }
      case "grid": {
        const kids = (n.children as unknown as SpecNode[]) ?? [];
        return (
          <div
            key={key}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${(n.cols as unknown as number) || 2}, minmax(0,1fr))`,
              gap: 10,
            }}
          >
            {kids.map((c, i) => draw(c, `${key}.${i}`))}
          </div>
        );
      }
      case "card": {
        const kids = (n.children as unknown as SpecNode[]) ?? [];
        return (
          <div key={key} className="card">
            {n.title && (
              <h4 style={{ marginBottom: 9 }}>{txt(n.title as unknown as string)}</h4>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {kids.map((c, i) => draw(c, `${key}.${i}`))}
            </div>
          </div>
        );
      }
      case "text":
        return (
          <div
            key={key}
            style={{
              fontSize: sizePx[(n.size as unknown as string) ?? "md"],
              color: toneVar[(n.tone as unknown as string) ?? "default"],
              fontWeight: n.bold ? 700 : 400,
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
            }}
          >
            {txt(n.value as unknown as string)}
          </div>
        );
      case "metric":
        return (
          <div key={key}>
            <div className="faint" style={{ fontSize: 11.5 }}>
              {txt(n.label as unknown as string)}
            </div>
            <div
              style={{
                fontSize: 27,
                fontWeight: 200,
                letterSpacing: -0.5,
                color: toneVar[(n.tone as unknown as string) ?? "default"],
              }}
            >
              {txt(n.value as unknown as string)}
            </div>
            {n.hint && (
              <div className="dim" style={{ fontSize: 11.5 }}>
                {txt(n.hint as unknown as string)}
              </div>
            )}
          </div>
        );
      case "badge":
        return (
          <span key={key} className={`chip ${(n.tone as unknown as string) ?? ""}`}>
            {txt(n.label as unknown as string)}
          </span>
        );
      case "divider":
        return <div key={key} className="hr" />;
      case "button":
        return (
          <button
            key={key}
            className={`btn ${(n.tone as unknown as string) === "accent" ? "primary" : ""}`}
            style={
              (n.tone as unknown as string) && (n.tone as unknown as string) !== "accent"
                ? { color: toneVar[n.tone as unknown as string] }
                : undefined
            }
            onClick={() => act(n.on as unknown as SpecAction)}
          >
            {txt(n.label as unknown as string)}
          </button>
        );
      case "input": {
        const k = n.key as unknown as string;
        const kind = (n.kind as unknown as string) ?? "text";
        return (
          <label key={key} style={{ display: "block" }}>
            {n.label && (
              <div className="faint" style={{ fontSize: 11.5, marginBottom: 4 }}>
                {txt(n.label as unknown as string)}
              </div>
            )}
            {kind === "area" ? (
              <textarea
                className="field"
                rows={3}
                placeholder={(n.placeholder as unknown as string) ?? ""}
                value={String(local[k] ?? "")}
                onChange={(e) => setLocal((p) => ({ ...p, [k]: e.target.value }))}
              />
            ) : (
              <input
                className="field"
                type={kind === "number" ? "number" : "text"}
                placeholder={(n.placeholder as unknown as string) ?? ""}
                value={String(local[k] ?? "")}
                onChange={(e) =>
                  setLocal((p) => ({
                    ...p,
                    [k]: kind === "number" ? Number(e.target.value) : e.target.value,
                  }))
                }
              />
            )}
          </label>
        );
      }
      case "toggle": {
        const k = n.key as unknown as string;
        const on = Boolean(local[k]);
        return (
          <button
            key={key}
            className="row"
            style={{ all: "unset", cursor: "pointer", display: "flex", gap: 9, alignItems: "center" }}
            onClick={() => setLocal((p) => ({ ...p, [k]: !on }))}
          >
            <span
              style={{
                width: 36,
                height: 20,
                borderRadius: 99,
                background: on ? "var(--accent)" : "rgb(var(--line) / 0.2)",
                position: "relative",
                transition: "background .18s ease",
                flex: "0 0 auto",
              }}
            >
              <i
                style={{
                  position: "absolute",
                  top: 3,
                  insetInlineStart: on ? 19 : 3,
                  width: 14,
                  height: 14,
                  borderRadius: 99,
                  background: "#fff",
                  transition: "inset-inline-start .18s ease",
                }}
              />
            </span>
            <span>{txt(n.label as unknown as string)}</span>
          </button>
        );
      }
      case "list": {
        const from = n.from as unknown as string | undefined;
        const dynamic = from && Array.isArray(local[from]) ? (local[from] as string[]) : null;
        const items = dynamic
          ? dynamic.map((title) => ({ title, sub: undefined, tone: undefined }))
          : ((n.items as unknown as { title: string; sub?: string; tone?: string }[]) ?? []);
        if (items.length === 0)
          return (
            <div key={key} className="faint" style={{ fontSize: 12.5, padding: "6px 2px" }}>
              {(n.empty as unknown as string) ?? "لا عناصر"}
            </div>
          );
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((it, i) => (
              <div key={i} className="list-row" style={{ cursor: "default" }}>
                <span style={{ color: toneVar[it.tone ?? "accent"] }}>•</span>
                <div className="grow">
                  <div>{txt(it.title)}</div>
                  {it.sub && (
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {txt(it.sub)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "bars": {
        const data = (n.data as unknown as { label: string; value: number }[]) ?? [];
        const max = Math.max(1, ...data.map((d) => d.value));
        return (
          <div key={key}>
            {n.label && <h4 style={{ marginBottom: 8 }}>{txt(n.label as unknown as string)}</h4>}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {data.map((d, i) => (
                <div key={i}>
                  <div className="row" style={{ fontSize: 11.5, justifyContent: "space-between" }}>
                    <span className="dim">{d.label}</span>
                    <span className="mono">{d.value}</span>
                  </div>
                  <div className="bar-track">
                    <i style={{ width: `${(d.value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case "progress":
        return (
          <div key={key}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="dim">{txt(n.label as unknown as string)}</span>
              <span className="mono">{Math.round(n.value as unknown as number)}%</span>
            </div>
            <div className="bar-track" style={{ marginTop: 5 }}>
              <i style={{ width: `${n.value as unknown as number}%` }} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app scroll spec-host">
      <div className="row" style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 18 }}>{spec.icon}</span>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{spec.name}</div>
          {spec.tagline && (
            <div className="faint" style={{ fontSize: 11.5 }}>
              {spec.tagline}
            </div>
          )}
        </div>
      </div>
      <div className="hr" />
      {draw(spec.root, "r")}
    </div>
  );
}
