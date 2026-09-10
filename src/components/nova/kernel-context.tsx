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
import { searchFs } from "@/lib/nova/fs";
import { fetchPulse, pulseToMarkdown } from "@/lib/nova/pulse-client";
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
  fireEvent: (when: string, ctx?: Record<string, string>) => void;
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
type Identity = { name: string; handle: string; role: string };

const ROLE_AR: Record<string, string> = {
  OWNER: "مالك",
  MANAGER: "مدير",
  WORKER: "عامل",
  VIEWER: "مشاهد",
};

function hydrate(neural: boolean, identity: Identity): NovaState {
  const fresh = initialState();
  fresh.cortex.backend = neural ? "neural" : "reflex";
  // الهوية تأتي من جلسة التطبيق لا من التخزين المحلي: من يجلس أمام النظام
  // حقيقةٌ يملكها الخادم، ولا يجوز أن يزيّفها تخزين المتصفح.
  fresh.user = { name: identity.name, handle: `${identity.handle} · ${ROLE_AR[identity.role] ?? identity.role}` };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<NovaState>;
    if (saved.version !== fresh.version) return fresh;
    return {
      ...fresh,
      ...saved,
      user: fresh.user,
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
  identity,
  children,
}: {
  neural: boolean;
  model: string;
  identity: Identity;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NovaState>(() => hydrate(neural, identity));
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<Plan | null>(null);
  const [desk, setDesk] = useState({ w: 1440, h: 820 });

  const ref = useRef<NovaState>(state);
  const baseline = useRef<NovaState | null>(null);
  const deskRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const firedSlots = useRef<Set<string>>(new Set());

  const commit = useCallback((next: NovaState) => {
    ref.current = next;
    setState(next);
  }, []);

  /** الأثر الجانبي الوحيد المسموح: ما لا يمكن أن يكون نقيًا (شبكة، وقت) */
  const consumeRef = useRef<(effects: Effect[]) => void>(() => {});
  const askRef = useRef<(q: string, c?: string) => Promise<string | null>>(async () => null);

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

        if (fx.kind === "navigate") {
          window.open(fx.route, "_blank", "noopener,noreferrer");
        }

        if (fx.kind === "farm-report") {
          void (async () => {
            const pulse = await fetchPulse();
            const body = pulse
              ? pulseToMarkdown(pulse)
              : "# تقرير المزرعة\n\nتعذّر قراءة البيانات من قاعدة بيانات التطبيق.";
            const r = execute(
              ref.current,
              { op: "fs.write", args: { path: fx.path, content: body, tags: ["مزرعة", "تقرير", "نبضة"], open: true } },
              "kernel"
            );
            commit(r.state);
            consumeRef.current(r.effects);
          })();
        }

        if (fx.kind === "agent-report") {
          void (async () => {
            const cur = ref.current;
            const agent = cur.agents.find((a) => a.id === fx.agentId);
            if (!agent) return;

            // السياق من ملفات المستخدم الحقيقية، لا من فراغ
            const terms = agent.goal
              .split(/\s+/)
              .filter((w) => w.length > 3)
              .slice(0, 6)
              .join(" ");
            const hits = terms ? searchFs(cur.fs, terms).slice(0, 5) : [];
            const evidence = hits
              .map((f) => `### ${f.path}\n${f.content.slice(0, 700)}`)
              .join("\n\n");

            let report: string | null = null;
            let source: "neural" | "reflex" = "reflex";
            if (neural) {
              report = await askRef.current(
                `أنت وكيل داخل نظام نوفا. هدفك: ${agent.goal}\n\nاكتب تقريرًا عربيًا موجزًا بصيغة Markdown: ما وجدته، ما يعنيه، وما الخطوة العملية التالية. إن كان السياق المرفق لا يكفي فقل ذلك صراحة بدل التخمين.`,
                evidence ? `سياق من ملفات المستخدم:\n${evidence}` : "لا توجد ملفات ذات صلة في النظام."
              );
              if (report) source = "neural";
            }

            if (!report) {
              // خلاصة حتمية محلية: تسرد ما وُجد فعلًا وتصرّح بحدودها
              report = [
                `# ${agent.name}`,
                "",
                `**الهدف:** ${agent.goal}`,
                "",
                `## ما وُجد في النظام (${hits.length} عنصرًا)`,
                hits.length
                  ? hits.map((f) => `- \`${f.path}\` — ${f.tags.join("، ") || "بلا وسوم"}`).join("\n")
                  : "- لا ملفات مطابقة للهدف.",
                "",
                "## الخطوات المنفّذة",
                agent.steps.map((st, i) => `${i + 1}. ${st.label} ✔`).join("\n"),
                "",
                "> صيغ هذا التقرير محليًا بطبقة الانعكاس: يسرد ما وُجد فعلًا ولا يستنتج.",
                "> مع ANTHROPIC_API_KEY يكتب العصب تحليلًا مبنيًا على محتوى هذه الملفات.",
                "",
                `_${new Date().toLocaleString("ar")}_`,
              ].join("\n");
            }

            const r = execute(ref.current, { op: "agent.finish", args: { id: agent.id, report, source } }, "agent");
            commit(r.state);
            consumeRef.current(r.effects);
          })();
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
    [commit, neural]
  );

  /** حقن أبعاد سطح المكتب الحقيقية: النداء المُسجّل يجب أن يصف ما حدث فعلًا */
  const withDesk = useCallback(
    (c: SyscallCall): SyscallCall =>
      c.op === "win.arrange" ? { op: c.op, args: { ...(c.args ?? {}), vw: desk.w, vh: desk.h } } : c,
    [desk.h, desk.w]
  );

  /**
   * الإرجاع الزمني: إعادة تشغيل السجل على نقطة الأساس.
   * لا يمكن أن يكون فرعًا داخل النواة النقية لأنه يحتاج نقطة الأساس ذاتها،
   * فهو المسار الوحيد الذي يعيش هنا — ويخدم الزر والنيّة والذكاء بلا تفرّع.
   */
  const rewindTo = useCallback((cur: NovaState, seq: number, origin: JournalEntry["origin"]): NovaState => {
    const base = baseline.current;
    if (!base) return cur;
    const restored = replay(base, cur.journal, seq);
    restored.seq = cur.seq + 1;
    restored.journal = [
      ...cur.journal,
      {
        seq: restored.seq,
        at: Date.now(),
        call: { op: "journal.rewind", args: { seq } },
        origin,
        ok: true,
        note: `رجوع إلى ${seq}`,
      },
    ];
    restored.notifications = [
      {
        id: `nt_rw_${restored.seq}`,
        title: "أُرجع النظام بالزمن",
        body: `الحالة الآن كما كانت عند النقطة ${seq}`,
        level: "warn" as const,
        at: Date.now(),
        read: false,
      },
      ...cur.notifications,
    ].slice(0, 40);
    return restored;
  }, []);

  /**
   * المُوزّع: ينفّذ خطة بالترتيب، ويكسرها عند حدود الإرجاع الزمني.
   * كل ما يدخل النظام — زر، أمر صدفة، نيّة، خطة من Claude — يعبر من هنا،
   * فلا يوجد نداء «يُفهَم في مكان ولا يُفهَم في آخر».
   */
  const dispatch = useCallback(
    (calls: SyscallCall[], origin: JournalEntry["origin"] = "user") => {
      let cur = ref.current;
      const effects: Effect[] = [];
      let batch: SyscallCall[] = [];

      const flush = () => {
        if (batch.length === 0) return;
        const r = executePlan(cur, batch, origin);
        cur = r.state;
        effects.push(...r.effects);
        batch = [];
      };

      for (const call of calls) {
        if (call.op === "journal.rewind") {
          flush();
          const seq = Number((call.args as { seq?: unknown } | undefined)?.seq ?? 0);
          cur = rewindTo(cur, Number.isFinite(seq) ? Math.max(0, seq) : 0, origin);
          continue;
        }
        batch.push(withDesk(call));
      }
      flush();

      // إعادة التشغيل تُصفّر السجل، فنقطة الأساس القديمة تصبح كذبة:
      // نثبّت أساسًا جديدًا وإلا قفز الإرجاع الزمني إلى حالة لم تحدث.
      if (calls.some((c) => c.op === "power" && (c.args as { action?: string } | undefined)?.action === "reboot")) {
        baseline.current = { ...cur, phase: "live", journal: [], seq: 0 };
      }

      commit(cur);
      consume(effects);
      return cur;
    },
    [commit, consume, rewindTo, withDesk]
  );

  /** مُطلِق أحداث النظام: القواعد تُنفَّذ بنفس دقة نداءات المستخدم */
  const fireEvent = useCallback(
    (when: string, ctx: Record<string, string> = {}) => {
      const matching = ref.current.automations.filter((a) => a.enabled && a.when === when);
      if (matching.length === 0) return;
      const fired = fireAutomations(ref.current, when, ctx, withDesk);
      commit(fired.state);
      consume(fired.effects);
    },
    [commit, consume, withDesk]
  );

  const run = useCallback(
    (call: SyscallCall, origin: JournalEntry["origin"] = "user") => {
      dispatch([call], origin);
    },
    [dispatch]
  );

  const runMany = useCallback(
    (calls: SyscallCall[], origin: JournalEntry["origin"] = "user") => {
      dispatch(calls, origin);
    },
    [dispatch]
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
      const after = dispatch([...spoken, ...plan.calls], plan.source);

      commit({
        ...after,
        cortex: {
          backend: plan.source,
          calls: after.cortex.calls + plan.calls.length,
          lastLatency: plan.latency,
          lastIntent: text,
        },
      });
      setLastPlan(plan);
      setBusy(false);
      return plan;
    },
    [commit, contextSummary, dispatch, neural]
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
      dispatch([{ op: "journal.rewind", args: { seq } }], "user");
    },
    [dispatch]
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
    askRef.current = ask;
    if (!baseline.current) {
      baseline.current = { ...ref.current, phase: "live", journal: [], seq: 0 };
    }

    const t = window.setTimeout(() => {
      const live = { ...ref.current, phase: "live" as const };
      const fired = fireAutomations(live, "boot", {}, (c) => c);
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

  // ── ساعة النظام: القواعد الزمنية تُطلق فعلًا، مرة واحدة لكل يوم
  useEffect(() => {
    if (state.phase !== "live") return undefined;
    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      const slot = hour >= 19 || hour < 5 ? "night" : hour === 12 ? "noon" : null;
      if (!slot) return;
      const stamp = `${now.toDateString()}:${slot}`;
      if (firedSlots.current.has(stamp)) return;
      firedSlots.current.add(stamp);
      fireEvent(slot, { hour: String(hour) });
    };
    check();
    const id = window.setInterval(check, 60000);
    return () => window.clearInterval(id);
  }, [fireEvent, state.phase]);

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
      fireEvent,
      runMany,
      submit,
      ask,
      compose,
      rewind,
      reset,
    }),
    [state, neural, model, busy, lastPlan, desk, run, fireEvent, runMany, submit, ask, compose, rewind, reset]
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
