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
import { IMPORT_LIMITS, clearSession, dataUrlToBlob, loadSession, readFile, saveSession } from "@/lib/nova/store";
import { execute, executePlan, fireAutomations, initialState, replay } from "@/lib/nova/kernel";
import { fold, reflexPlan } from "@/lib/nova/reflex";
import { fallbackSpec, parseSpec } from "@/lib/nova/spec";
import { sanitizePlan } from "@/lib/nova/syscalls";
import type { Effect, JournalEntry, NovaState, Plan, SyscallCall } from "@/lib/nova/types";


export type Edition = "web" | "device";

type NovaApi = {
  state: NovaState;
  neural: boolean;
  model: string;
  /** أين تعمل نوفا: خلف خادم التطبيق، أم مُضمَّنة في جهاز بلا خادم */
  edition: Edition;
  busy: boolean;
  lastPlan: Plan | null;
  desk: { w: number; h: number };
  deskRef: React.RefObject<HTMLDivElement | null>;
  run: (call: SyscallCall, origin?: JournalEntry["origin"], actor?: string) => void;
  /** طلب صلاحية معلّق ينتظر قرار المستخدم */
  consent: { app: string; cap: string; call: SyscallCall } | null;
  importFiles: (files: FileList | File[], dir?: string) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  pickDirRef: React.RefObject<string>;
  decideConsent: (approve: boolean) => void;
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
    grants: s.grants,
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
  return fresh;
}

/** يدمج جلسة محفوظة على حالة نظيفة، مع إسقاط ما لا يجوز استعادته */
function merge(fresh: NovaState, saved: Partial<NovaState>): NovaState {
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
    phase: "live",
    cortex: fresh.cortex,
    // أسطح قديمة قد لا تحتوي السطح المحفوظ: نضمن سطحًا صالحًا دائمًا
    spaces: saved.spaces?.length ? saved.spaces : fresh.spaces,
    space:
      saved.space && (saved.spaces ?? fresh.spaces).some((sp) => sp.id === saved.space)
        ? saved.space
        : (saved.spaces ?? fresh.spaces)[0].id,
    grants: saved.grants ?? {},
  } as NovaState;
}

export function KernelProvider({
  neural,
  model,
  identity,
  edition = "web",
  children,
}: {
  neural: boolean;
  model: string;
  identity: Identity;
  edition?: Edition;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NovaState>(() => hydrate(neural, identity));
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<Plan | null>(null);
  const [desk, setDesk] = useState({ w: 1440, h: 820 });
  // طلب الصلاحية شأن واجهة عابر لا حالة نظام: لا يُسجّل ولا يُرجَع بالزمن.
  const [consent, setConsent] = useState<{ app: string; cap: string; call: SyscallCall } | null>(null);

  const ref = useRef<NovaState>(state);
  const baseline = useRef<NovaState | null>(null);
  const deskRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const firedSlots = useRef<Set<string>>(new Set());
  const warnedStorage = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pickDir = useRef<string>("/بيتي/مستورد");

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

        if (fx.kind === "consent") {
          setConsent({ app: fx.app, cap: fx.cap, call: fx.call });
        }

        if (fx.kind === "pick-files") {
          pickDir.current = fx.dir;
          fileInput.current?.click();
        }

        if (fx.kind === "download") {
          // التنزيل من الذاكرة: لا خادم في المسار، والملف يخرج كما هو محفوظ
          try {
            const blob = fx.content.startsWith("data:")
              ? dataUrlToBlob(fx.content)
              : new Blob([fx.content], { type: `${fx.mime};charset=utf-8` });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fx.path.split("/").pop() || "nova-file";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 4000);
          } catch {
            const r = execute(
              ref.current,
              { op: "notify", args: { title: "تعذّر التصدير", level: "error" } },
              "kernel"
            );
            commit(r.state);
          }
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
            // نسخة الجهاز بلا خادم: الطلب سيفشل يقينًا، وانتظار فشله تأخير
            // بلا فائدة وضجيج في السجل. نذهب إلى المواصفة الاحتياطية مباشرة.
            if (edition === "device") {
              const r = execute(
                ref.current,
                {
                  op: "app.install",
                  args: {
                    id: fx.targetId,
                    name: fallbackSpec(fx.prompt).name,
                    icon: fallbackSpec(fx.prompt).icon,
                    prompt: fx.prompt,
                    spec: fallbackSpec(fx.prompt),
                    source: "reflex",
                  },
                },
                "kernel"
              );
              commit(r.state);
              consumeRef.current(r.effects);
              return;
            }
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
    [commit, edition, neural]
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
    (calls: SyscallCall[], origin: JournalEntry["origin"] = "user", actor?: string) => {
      let cur = ref.current;
      const effects: Effect[] = [];
      let batch: SyscallCall[] = [];

      const flush = () => {
        if (batch.length === 0) return;
        const r = executePlan(cur, batch, origin, true, actor);
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
    (call: SyscallCall, origin: JournalEntry["origin"] = "user", actor?: string) => {
      dispatch([call], origin, actor);
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
      dispatch([...spoken, ...plan.calls], plan.source);

      /**
       * نقرأ من ref لا من قيمة أعادها dispatch.
       *
       * بعض الآثار تُنفّذ *متزامنًا* داخل dispatch (مثل تثبيت تطبيق مولّد في
       * نسخة الجهاز حيث لا شبكة تُنتظر). لو أودعنا الحالة التي التقطناها قبلها
       * لطمسناها — وهذا ما كان يحدث فعلًا: التطبيق يُثبَّت ثم يختفي.
       * ref.current هو آخر حالة مُودَعة دائمًا، فالبناء عليه آمن في الحالتين.
       */
      const latest = ref.current;
      commit({
        ...latest,
        cortex: {
          backend: plan.source,
          calls: latest.cortex.calls + plan.calls.length,
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

  const decideConsent = useCallback(
    (approve: boolean) => {
      const req = consent;
      setConsent(null);
      if (!req) return;
      if (!approve) {
        dispatch(
          [
            {
              op: "notify",
              args: { title: "رُفض الطلب", body: `لم تُمنح «${req.app}» صلاحية ${req.cap}`, level: "warn" },
            },
          ],
          "user"
        );
        return;
      }
      // المنح نداء نظام من المستخدم (بلا actor)، ثم يُعاد النداء الأصلي بصفة التطبيق
      dispatch([{ op: "grant.add", args: { app: req.app, cap: req.cap } }], "user");
      dispatch([req.call], "neural", req.app);
    },
    [consent, dispatch]
  );

  /**
   * استيراد ملفات حقيقية.
   * يخدم مسارين: منتقي النظام، والسحب والإفلات على سطح المكتب — وكلاهما
   * ينتهي إلى نداءات fs.write، فيُسجَّل الاستيراد ويمكن الرجوع عنه.
   */
  const importFiles = useCallback(
    async (files: FileList | File[], dir = "/بيتي/مستورد") => {
      const list = Array.from(files).slice(0, IMPORT_LIMITS.maxFiles);
      const calls: SyscallCall[] = [];
      let skipped = 0;

      for (const file of list) {
        const read = await readFile(file);
        if (!read) {
          skipped += 1;
          continue;
        }
        const safe = file.name.replace(/[\\:*?"<>|]/g, "").slice(0, 80) || "ملف";
        calls.push({
          op: "fs.write",
          args: {
            path: `${dir}/${safe}`,
            content: read.content,
            tags: ["مستورد", read.kind === "image" ? "صورة" : "نص"],
          },
        });
      }

      if (calls.length) dispatch(calls, "user");
      dispatch(
        [
          {
            op: "notify",
            args: {
              title: calls.length ? `استُورد ${calls.length} ملفًا` : "لم يُستورد شيء",
              body: skipped
                ? `تُجوهل ${skipped} ملفًا (نوع غير مدعوم أو أكبر من 3 م.ب)`
                : `إلى ${dir}`,
              level: calls.length ? "ok" : "warn",
            },
          },
        ],
        "kernel"
      );
    },
    [dispatch]
  );

  const rewind = useCallback(
    (seq: number) => {
      dispatch([{ op: "journal.rewind", args: { seq } }], "user");
    },
    [dispatch]
  );

  const reset = useCallback(() => {
    void clearSession();
    const fresh = initialState();
    fresh.phase = "live";
    baseline.current = { ...fresh, journal: [], seq: 0 };
    commit(fresh);
  }, [commit]);

  // ── الإقلاع: قراءة الجلسة (غير متزامنة)، تثبيت نقطة الأساس، ثم قواعد الإقلاع
  useEffect(() => {
    consumeRef.current = consume;
    askRef.current = ask;
    let alive = true;

    // نضمن زمنًا أدنى للإقلاع: قراءة الجلسة قد تكون فورية، وشاشة الإقلاع
    // تعرض حالة النواة سطرًا سطرًا — قطعها في 40ms يُفقد المعنى لا يُسرّعه.
    const minimum = new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 2200);
      timers.current.push(t);
    });

    Promise.all([loadSession<Partial<NovaState>>(), minimum]).then(([saved]) => {
      if (!alive) return;
      const merged = saved ? merge(ref.current, saved) : { ...ref.current, phase: "live" as const };
      baseline.current = { ...merged, phase: "live", journal: [], seq: 0 };
      commit(merged);
      const fired = fireAutomations(merged, "boot", {}, (c) => c);
      commit(fired.state);
      consumeRef.current(fired.effects);
    });

    return () => {
      alive = false;
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

  // ── الحفظ التلقائي (IndexedDB مع احتياط localStorage)
  useEffect(() => {
    if (state.phase === "boot") return undefined;
    const id = window.setTimeout(() => {
      void saveSession(persistable(state)).then((where) => {
        if (where === "none" && !warnedStorage.current) {
          warnedStorage.current = true;
          // الصدق أولى من الصمت: المستخدم يجب أن يعرف أن جلسته لن تدوم
          const r = execute(
            ref.current,
            {
              op: "notify",
              args: {
                title: "تعذّر حفظ الجلسة",
                body: "التخزين ممتلئ أو محجوب في هذا المتصفح. النظام يعمل، لكن ما تفعله لن يدوم بعد الإغلاق.",
                level: "warn",
              },
            },
            "kernel"
          );
          commit(r.state);
        }
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [commit, state]);

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
      edition,
      busy,
      lastPlan,
      desk,
      deskRef,
      run,
      consent,
      decideConsent,
      importFiles,
      fileInputRef: fileInput,
      pickDirRef: pickDir,
      fireEvent,
      runMany,
      submit,
      ask,
      compose,
      rewind,
      reset,
    }),
    [
      state,
      neural,
      model,
      edition,
      busy,
      lastPlan,
      desk,
      run,
      consent,
      decideConsent,
      importFiles,
      fireEvent,
      runMany,
      submit,
      ask,
      compose,
      rewind,
      reset,
    ]
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
