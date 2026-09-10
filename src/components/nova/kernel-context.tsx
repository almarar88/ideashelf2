"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_MAP } from "@/lib/nova/apps";
import { execute, executePlan, fireAutomations, initialState, replay } from "@/lib/nova/kernel";
import { fold, reflexPlan } from "@/lib/nova/reflex";
import { fallbackSpec, parseSpec } from "@/lib/nova/spec";
import { sanitizePlan } from "@/lib/nova/syscalls";
import type { Effect, JournalEntry, NovaState, Plan, SyscallCall } from "@/lib/nova/types";

const STORE_KEY = "nova.os.v1";

type NovaApi = {
  state: NovaState;
  neural: boolean;
  model: string;
  busy: boolean;
  lastPlan: Plan | null;
  desk: { w: number; h: number };
  deskRef: React.RefObject<HTMLDivElement | null>;
  run: (call: SyscallCall, origin?: JournalEntry["origin"]) => void;
  runMany: (calls: SyscallCall[], origin?: JournalEntry["origin"]) => void;
  submit: (intent: string) => Promise<Plan | null>;
  ask: (question: string, context?: string) => Promise<string | null>;
  compose: (prompt: string) => Promise<void>;
  rewind: (seq: number) => void;
  reset: () => void;
};

const Ctx = createContext<NovaApi | null>(null);

export function useNova(): NovaApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useNova خارج مزوّد النواة");
  return api;
}

/** ما يُحفَظ بين الجلسات — بلا سجل: الإرجاع الزمني محلي للجلسة بحكم التصميم */
function persistable(s: NovaState) {
  return {
    version: s.version,
    user: s.user,
    theme: s.theme,
    fs: s.fs,
    automations: s.automations,
    composed: s.composed,
    windows: s.windows,
    focus: s.focus,
    zTop: s.zTop,
    dialog: s.dialog.slice(-24),
  };
}

/** يقرأ الجلسة المحفوظة عند أول تصيير — لا خادم هنا، فلا خطر ترطيب */
function hydrate(neural: boolean): NovaState {
  const fresh = initialState();
  fresh.cortex.backend = neural ? "neural" : "reflex";
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<NovaState>;
    if (saved.version !== fresh.version) return fresh;
    return {
      ...fresh,
      ...saved,
      // السجل والوكلاء والإشعارات لا تُستعاد: الإرجاع الزمني محلي للجلسة بقصد
      journal: [],
      seq: 0,
      agents: [],
      notifications: [],
      phase: "boot",
      cortex: fresh.cortex,
    } as NovaState;
  } catch {
    // بيانات تالفة أو تخزين محجوب: نُقلع نظيفين بدل أن نفشل
    return fresh;
  }
}

export function KernelProvider({
  neural,
  model,
  children,
}: {
  neural: boolean;
  model: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NovaState>(() => hydrate(neural));
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<Plan | null>(null);
  const [desk, setDesk] = useState({ w: 1440, h: 820 });

  const ref = useRef<NovaState>(state);
  const baseline = useRef<NovaState | null>(null);
  const deskRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  const commit = useCallback((next: NovaState) => {
    ref.current = next;
    setState(next);
  }, []);

  /** الأثر الجانبي الوحيد المسموح: ما لا يمكن أن يكون نقيًا (شبكة، وقت) */
  const consumeRef = useRef<(effects: Effect[]) => void>(() => {});

  const consume = useCallback(
    (effects: Effect[]) => {
      for (const fx of effects) {
        if (fx.kind === "agent-tick") {
          const id = window.setTimeout(() => {
            const r = execute(ref.current, { op: "agent.step", args: { id: fx.agentId } }, "agent");
            commit(r.state);
            consumeRef.current(r.effects);
          }, 700 + Math.random() * 900);
          timers.current.push(id);
        }

        if (fx.kind === "compose") {
          void (async () => {
            let spec = null;
            let source: "neural" | "reflex" = "reflex";
            try {
              const res = await fetch("/api/nova/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: fx.prompt }),
              });
              if (res.ok) {
                const data = await res.json();
                spec = parseSpec(data.spec);
                source = data.source === "neural" ? "neural" : "reflex";
              }
            } catch {
              /* بلا شبكة: تتولّى المواصفة الاحتياطية المهمة */
            }
            const finalSpec = spec ?? fallbackSpec(fx.prompt);
            const r = execute(
              ref.current,
              {
                op: "app.install",
                args: {
                  id: fx.targetId,
                  name: finalSpec.name,
                  icon: finalSpec.icon,
                  prompt: fx.prompt,
                  spec: finalSpec,
                  source,
                },
              },
              source === "neural" ? "neural" : "kernel"
            );
            commit(r.state);
            consumeRef.current(r.effects);
          })();
        }
      }
    },
    [commit]
  );

  const run = useCallback(
    (call: SyscallCall, origin: JournalEntry["origin"] = "user") => {
      let c = call;
      if (call.op === "win.arrange") {
        c = { op: call.op, args: { ...(call.args ?? {}), vw: desk.w, vh: desk.h } };
      }
      const r = execute(ref.current, c, origin);
      commit(r.state);
      consume(r.effects);
    },
    [commit, consume, desk.h, desk.w]
  );

  const runMany = useCallback(
    (calls: SyscallCall[], origin: JournalEntry["origin"] = "user") => {
      const patched = calls.map((c) =>
        c.op === "win.arrange" ? { op: c.op, args: { ...(c.args ?? {}), vw: desk.w, vh: desk.h } } : c
      );
      const r = executePlan(ref.current, patched, origin);
      commit(r.state);
      consume(r.effects);
    },
    [commit, consume, desk.h, desk.w]
  );

  /** ملخص الحالة الذي تراه طبقة العصب — صغير بقصد: لا تسريب محتوى ولا كلفة رموز */
  const contextSummary = useCallback((s: NovaState) => {
    const open = s.windows.map((w) => `${w.app}#${w.id}${w.minimized ? "(مصغّرة)" : ""}`).join(", ") || "لا شيء";
    const made = s.composed.map((c) => `${c.id}=${c.name}`).join(", ") || "لا شيء";
    return [
      `النوافذ المفتوحة: ${open}`,
      `النافذة النشطة: ${s.focus ?? "لا شيء"}`,
      `تطبيقات مولّدة (تُفتح بمعرّفها): ${made}`,
      `المظهر: ${s.theme.mode} / ${s.theme.accent} / ${s.theme.wallpaper}`,
      `مسارات المحتوى: ${s.fs.map((f) => f.path).slice(0, 24).join(", ")}`,
      `الوكلاء النشطون: ${s.agents.filter((a) => a.state === "running").map((a) => a.name).join(", ") || "لا شيء"}`,
      `تسلسل السجل الحالي: ${s.seq}`,
    ].join("\n");
  }, []);

  const submit = useCallback(
    async (intent: string): Promise<Plan | null> => {
      const text = intent.trim();
      if (!text) return null;

      const withUser = {
        ...ref.current,
        dialog: [...ref.current.dialog, { role: "user" as const, text, at: Date.now() }].slice(-80),
        cortex: { ...ref.current.cortex, lastIntent: text },
      };
      commit(withUser);
      setBusy(true);

      let plan: Plan | null = null;
      if (neural) {
        try {
          const res = await fetch("/api/nova/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ intent: text, context: contextSummary(ref.current) }),
          });
          const data = await res.json();
          if (data?.available && data.plan) {
            const clean = sanitizePlan(data.plan.calls);
            plan = { ...data.plan, calls: clean.calls, source: "neural" };
          }
        } catch {
          /* الشبكة سقطت — الانعكاس المحلي يتكفّل */
        }
      }
      if (!plan) plan = reflexPlan(text, ref.current);

      const spoken: SyscallCall[] = plan.say ? [{ op: "say", args: { text: plan.say } }] : [];
      const r = executePlan(ref.current, [...spoken, ...plan.calls], plan.source);

      const next: NovaState = {
        ...r.state,
        cortex: {
          backend: plan.source,
          calls: r.state.cortex.calls + plan.calls.length,
          lastLatency: plan.latency,
          lastIntent: text,
        },
      };
      commit(next);
      consume(r.effects);
      setLastPlan(plan);
      setBusy(false);
      return plan;
    },
    [commit, consume, contextSummary, neural]
  );

  const ask = useCallback(
    async (question: string, context = ""): Promise<string | null> => {
      if (!neural) return null;
      try {
        const res = await fetch("/api/nova/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, context }),
        });
        const data = await res.json();
        return data?.available ? (data.answer as string) : null;
      } catch {
        return null;
      }
    },
    [neural]
  );

  const compose = useCallback(
    async (prompt: string) => {
      run({ op: "app.compose", args: { prompt } });
    },
    [run]
  );

  const rewind = useCallback(
    (seq: number) => {
      const base = baseline.current;
      if (!base) return;
      const restored = replay(base, ref.current.journal, seq);
      restored.journal = [
        ...ref.current.journal,
        {
          seq: ref.current.seq + 1,
          at: Date.now(),
          call: { op: "journal.rewind", args: { seq } },
          origin: "user",
          ok: true,
          note: `رجوع إلى ${seq}`,
        },
      ];
      restored.seq = ref.current.seq + 1;
      restored.notifications = [
        {
          id: `nt_rw_${seq}`,
          title: "أُرجع النظام بالزمن",
          body: `الحالة الآن كما كانت عند النقطة ${seq}`,
          level: "warn" as const,
          at: Date.now(),
          read: false,
        },
        ...ref.current.notifications,
      ].slice(0, 40);
      commit(restored);
    },
    [commit]
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch {
      /* التخزين محجوب — لا يهم */
    }
    const fresh = initialState();
    fresh.phase = "live";
    baseline.current = { ...fresh, journal: [], seq: 0 };
    commit(fresh);
  }, [commit]);

  // ── الإقلاع: تثبيت نقطة الأساس، ثم الانتقال إلى الحياة وتشغيل قواعد الإقلاع
  useEffect(() => {
    consumeRef.current = consume;
    if (!baseline.current) {
      baseline.current = { ...ref.current, phase: "live", journal: [], seq: 0 };
    }

    const t = window.setTimeout(() => {
      const live = { ...ref.current, phase: "live" as const };
      const fired = fireAutomations(live, "boot");
      commit(fired.state);
      consumeRef.current(fired.effects);
    }, 2600);
    timers.current.push(t);

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── الحفظ التلقائي
  useEffect(() => {
    if (state.phase === "boot") return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(persistable(state)));
      } catch {
        /* ممتلئ أو محجوب */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [state]);

  // ── قياس سطح المكتب الحقيقي
  useEffect(() => {
    const measure = () => {
      const el = deskRef.current;
      if (el) setDesk({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state.phase]);

  const api = useMemo<NovaApi>(
    () => ({
      state,
      neural,
      model,
      busy,
      lastPlan,
      desk,
      deskRef,
      run,
      runMany,
      submit,
      ask,
      compose,
      rewind,
      reset,
    }),
    [state, neural, model, busy, lastPlan, desk, run, runMany, submit, ask, compose, rewind, reset]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** أيقونة أي تطبيق: مثبّت أو مولّد */
export function iconOf(state: NovaState, app: string): string {
  return APP_MAP[app]?.icon ?? state.composed.find((c) => c.id === app)?.icon ?? "▣";
}

export function nameOf(state: NovaState, app: string): string {
  return APP_MAP[app]?.name ?? state.composed.find((c) => c.id === app)?.name ?? app;
}

export { fold };
