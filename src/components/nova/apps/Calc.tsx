"use client";

import { useState } from "react";
import { useNova } from "../kernel-context";
import type { NovaWindow } from "@/lib/nova/types";

/**
 * الحاسبة.
 *
 * تكتب شريطًا (tape) لكل عملية، وتستطيع حفظه في المحتوى — فالحساب في نظام
 * تشغيل ليس نتيجة عابرة بل أثرًا يمكن الرجوع إليه.
 * التقييم يجري بآلة صغيرة مكتوبة هنا، لا بـ eval: نفس القاعدة التي تمنع
 * تشغيل أي كود مولّد تمنع تشغيل نص المستخدم أيضًا.
 */

type Token = { t: "num"; v: number } | { t: "op"; v: string } | { t: "paren"; v: "(" | ")" };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  const text = src.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[×xX]/g, "*").replace(/[÷]/g, "/").replace(/,/g, "");
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j])) j += 1;
      const n = Number(text.slice(i, j));
      if (!Number.isFinite(n)) return null;
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if ("+-*/%^".includes(ch)) {
      out.push({ t: "op", v: ch });
      i += 1;
      continue;
    }
    if (ch === "(" || ch === ")") {
      out.push({ t: "paren", v: ch });
      i += 1;
      continue;
    }
    return null;
  }
  return out;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

/** تقييم بترتيب الأولويات (Shunting-yard) — حتمي وبلا تنفيذ كود */
function evaluate(src: string): number | null {
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return null;
  const values: number[] = [];
  const ops: string[] = [];

  const apply = () => {
    const op = ops.pop();
    const b = values.pop();
    const a = values.pop();
    if (op === undefined || a === undefined || b === undefined) return false;
    if (op === "+") values.push(a + b);
    else if (op === "-") values.push(a - b);
    else if (op === "*") values.push(a * b);
    else if (op === "/") values.push(b === 0 ? NaN : a / b);
    else if (op === "%") values.push(b === 0 ? NaN : a % b);
    else if (op === "^") values.push(Math.pow(a, b));
    else return false;
    return true;
  };

  for (let k = 0; k < tokens.length; k += 1) {
    const tok = tokens[k];
    if (tok.t === "num") values.push(tok.v);
    else if (tok.t === "paren" && tok.v === "(") ops.push("(");
    else if (tok.t === "paren") {
      while (ops.length && ops[ops.length - 1] !== "(") if (!apply()) return null;
      if (ops.pop() !== "(") return null;
    } else {
      // سالب أحادي في بداية التعبير أو بعد عامل
      const prev = tokens[k - 1];
      if (tok.v === "-" && (!prev || prev.t === "op" || (prev.t === "paren" && prev.v === "("))) {
        values.push(0);
      }
      while (ops.length && ops[ops.length - 1] !== "(" && PREC[ops[ops.length - 1]] >= PREC[tok.v]) {
        if (!apply()) return null;
      }
      ops.push(tok.v);
    }
  }
  while (ops.length) if (!apply()) return null;
  if (values.length !== 1) return null;
  return Number.isFinite(values[0]) ? values[0] : null;
}

const KEYS = [
  ["(", ")", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", "^", "="],
];

export default function Calc({ win }: { win: NovaWindow }) {
  const { run } = useNova();
  // النيّة قد تحمل التعبير: «احسب 1280 × 12» يفتح الحاسبة محمّلة لا فارغة
  const [expr, setExpr] = useState(String(win.props.expr ?? ""));
  const [tape, setTape] = useState<{ expr: string; value: string }[]>([]);

  const compute = () => {
    const value = evaluate(expr);
    if (value === null) {
      setTape((t) => [{ expr, value: "تعبير غير صالح" }, ...t].slice(0, 40));
      return;
    }
    const shown = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
    setTape((t) => [{ expr, value: shown }, ...t].slice(0, 40));
    setExpr(shown);
  };

  const press = (k: string) => {
    if (k === "=") return compute();
    setExpr((e) => e + k);
  };

  const live = evaluate(expr);

  return (
    <div className="app">
      <div className="card" style={{ textAlign: "left", direction: "ltr" }}>
        <input
          className="field mono"
          style={{ fontSize: 20, textAlign: "left", direction: "ltr", border: "none", background: "transparent" }}
          value={expr}
          placeholder="0"
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && compute()}
        />
        <div className="faint mono" style={{ fontSize: 12, minHeight: 18, textAlign: "left" }}>
          {expr && live !== null ? `= ${Number.isInteger(live) ? live : Number(live.toFixed(10))}` : expr ? "…" : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {KEYS.flat().map((k) => (
          <button
            key={k}
            className={`btn ${k === "=" ? "primary" : ""}`}
            style={{ justifyContent: "center", padding: "11px 0", fontSize: 15 }}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
        <button className="btn" style={{ justifyContent: "center" }} onClick={() => setExpr("")}>
          مسح
        </button>
        <button
          className="btn"
          style={{ justifyContent: "center" }}
          onClick={() => setExpr((e) => e.slice(0, -1))}
        >
          ⌫
        </button>
        <button
          className="btn"
          style={{ justifyContent: "center", gridColumn: "span 2" }}
          disabled={tape.length === 0}
          onClick={() =>
            run({
              op: "fs.write",
              args: {
                path: "/بيتي/شريط-الحاسبة.md",
                content: `# شريط الحاسبة\n\n${tape
                  .map((row) => `- \`${row.expr}\` = **${row.value}**`)
                  .join("\n")}\n`,
                tags: ["حاسبة", "حساب"],
              },
            })
          }
        >
          احفظ الشريط
        </button>
      </div>

      <div className="scroll grow" style={{ marginTop: 2 }}>
        {tape.length === 0 && (
          <div className="faint" style={{ fontSize: 12 }}>
            الشريط يسجّل كل عملية. اكتب تعبيرًا واضغط Enter.
          </div>
        )}
        {tape.map((row, i) => (
          <div key={i} className="kv mono ltr" style={{ fontSize: 12 }}>
            <span className="dim">{row.expr}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
