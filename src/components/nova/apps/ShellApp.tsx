"use client";

import { useEffect, useRef, useState } from "react";
import { searchFs } from "@/lib/nova/fs";
import { SYSCALLS } from "@/lib/nova/syscalls";
import { useNova } from "../kernel-context";

type Line = { text: string; kind: "in" | "out" | "err" | "sys" };

const HELP = `أوامر nsh:
  ls [نمط]           سرد المحتوى
  cat <مسار>         عرض ملف
  write <مسار> <نص>  كتابة ملف
  rm <مسار>          حذف
  open <تطبيق>       فتح نافذة
  ps                 الوكلاء العاملون
  syscalls           جدول نداءات النظام
  journal [عدد]      آخر النداءات
  theme <night|dawn|#hex>
  arrange <grid|cascade|split|focus>
  clear              تنظيف الشاشة
أي شيء آخر يُفهم كنيّة ويُمرّر إلى النواة الذكية.`;

/** الصدفة: الأوامر واللغة الطبيعية في سطر إدخال واحد. */
export default function ShellApp() {
  const { state, run, submit } = useNova();
  const [lines, setLines] = useState<Line[]>([
    { text: "nova shell (nsh) 1.0 — اكتب help، أو تحدّث بالعربية مباشرة.", kind: "sys" },
  ]);
  const [text, setText] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const out = (text: string, kind: Line["kind"] = "out") =>
    setLines((l) => [...l, { text, kind }].slice(-260));

  const exec = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    out(cmd, "in");
    setHist((h) => [cmd, ...h].slice(0, 60));
    setHi(-1);

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    switch (head) {
      case "help":
        return out(HELP);
      case "clear":
        return setLines([]);
      case "ls": {
        const list = arg ? searchFs(state.fs, arg) : state.fs;
        return out(
          list.length
            ? list.map((f) => `${f.kind === "dir" ? "d" : "-"} ${f.path.padEnd(34)} ${f.tags.join(",")}`).join("\n")
            : "لا شيء"
        );
      }
      case "cat": {
        const f = state.fs.find((x) => x.path.includes(arg));
        return f ? out(f.content) : out(`لا ملف يطابق ${arg}`, "err");
      }
      case "write": {
        const [p, ...body] = rest;
        if (!p) return out("الاستخدام: write <مسار> <نص>", "err");
        run({ op: "fs.write", args: { path: p, content: body.join(" ") } });
        return out(`كُتب ${p}`);
      }
      case "rm":
        if (!arg) return out("الاستخدام: rm <مسار>", "err");
        run({ op: "fs.delete", args: { path: arg } });
        return out(`حُذف ${arg}`);
      case "open":
        if (!arg) return out("الاستخدام: open <تطبيق>", "err");
        run({ op: "win.open", args: { app: arg } });
        return out(`فتح ${arg}`);
      case "ps": {
        if (state.agents.length === 0) return out("لا وكلاء");
        return out(
          state.agents
            .map(
              (a) =>
                `${a.id}  ${a.state.padEnd(8)} cpu=${String(a.cpu).padStart(2)}%  ${
                  a.steps.filter((s) => s.done).length
                }/${a.steps.length}  ${a.name}`
            )
            .join("\n")
        );
      }
      case "syscalls":
        return out(
          Object.entries(SYSCALLS)
            .map(([op, d]) => `${op.padEnd(20)} ${d.title}`)
            .join("\n")
        );
      case "journal": {
        const n = Number(arg) || 14;
        return out(
          state.journal
            .slice(-n)
            .map((j) => `${String(j.seq).padStart(4)} ${j.ok ? "✓" : "✗"} ${j.origin.padEnd(10)} ${j.call.op}`)
            .join("\n") || "السجل فارغ"
        );
      }
      case "theme": {
        if (arg.startsWith("#")) run({ op: "theme.set", args: { accent: arg } });
        else if (arg === "night" || arg === "dawn") run({ op: "theme.set", args: { mode: arg } });
        else return out("الاستخدام: theme <night|dawn|#hex>", "err");
        return out("طُبّق");
      }
      case "arrange":
        run({ op: "win.arrange", args: { mode: arg || "grid" } });
        return out(`رُتّب: ${arg || "grid"}`);
      default: {
        out("↯ يُمرّر إلى النواة كنيّة…", "sys");
        const plan = await submit(cmd);
        if (plan) {
          if (plan.say) out(plan.say);
          plan.calls.forEach((c) => out(`  → ${c.op} ${JSON.stringify(c.args ?? {})}`, "sys"));
          if (plan.calls.length === 0) out("  (بلا نداءات)", "sys");
        }
      }
    }
  };

  return (
    <div className="app">
      <div className="scroll term">
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              color:
                l.kind === "err"
                  ? "var(--danger)"
                  : l.kind === "sys"
                  ? "var(--ink-faint)"
                  : l.kind === "in"
                  ? "var(--accent)"
                  : "var(--ink)",
            }}
          >
            {l.kind === "in" ? `❯ ${l.text}` : l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="term-in">
        <span className="accent mono">❯</span>
        <input
          value={text}
          placeholder="help أو تحدّث بالعربية…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = text;
              setText("");
              void exec(v);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const n = Math.min(hist.length - 1, hi + 1);
              if (n >= 0) {
                setHi(n);
                setText(hist[n]);
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const n = hi - 1;
              setHi(n);
              setText(n >= 0 ? hist[n] : "");
            }
          }}
        />
      </div>
    </div>
  );
}
