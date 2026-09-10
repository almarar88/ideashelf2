import { APP_MAP, APPS } from "./apps";
import { basename, nid, normalize, seedFs } from "./fs";
import { validateCall } from "./syscalls";
import type {
  Effect,
  ExecResult,
  JournalEntry,
  NovaState,
  NovaWindow,
  SyscallCall,
} from "./types";

export const STATE_VERSION = 1;
export const DESK = { w: 1440, h: 820 }; // مساحة مرجعية؛ الواجهة تُقيسها فعليًا

export function initialState(): NovaState {
  return {
    version: STATE_VERSION,
    phase: "boot",
    user: { name: "مالك النظام", handle: "@owner" },
    theme: { mode: "night", accent: "#7c5cff", wallpaper: "aurora", motion: true, glass: 0.72 },
    windows: [],
    focus: null,
    zTop: 10,
    fs: seedFs(),
    notifications: [],
    journal: [],
    seq: 0,
    agents: [],
    automations: [
      {
        id: "au_boot",
        label: "عند الإقلاع: افتح الأوراكل ورحّب بي",
        when: "boot",
        then: [{ op: "win.open", args: { app: "oracle" } }],
        enabled: true,
        hits: 0,
      },
      {
        id: "au_agent",
        label: "عند انتهاء وكيل: أشعرني",
        when: "agent-done",
        then: [{ op: "notify", args: { title: "وكيل أنجز مهمته", level: "ok" } }],
        enabled: true,
        hits: 0,
      },
    ],
    composed: [],
    clipboard: "",
    cortex: { backend: "reflex", calls: 0, lastLatency: 0, lastIntent: "" },
    dialog: [],
  };
}

function clone(s: NovaState): NovaState {
  return {
    ...s,
    theme: { ...s.theme },
    user: { ...s.user },
    cortex: { ...s.cortex },
    windows: s.windows.map((w) => ({ ...w, props: { ...w.props } })),
    fs: s.fs.map((f) => ({ ...f, tags: [...f.tags] })),
    notifications: s.notifications.map((n) => ({ ...n })),
    journal: [...s.journal],
    agents: s.agents.map((a) => ({ ...a, steps: a.steps.map((st) => ({ ...st })) })),
    automations: s.automations.map((a) => ({ ...a, then: [...a.then] })),
    composed: [...s.composed],
    dialog: [...s.dialog],
  };
}

function push(s: NovaState, n: Omit<import("./types").NovaNotification, "id" | "at" | "read">) {
  s.notifications = [
    { id: nid("nt"), at: Date.now(), read: false, ...n },
    ...s.notifications,
  ].slice(0, 40);
}

function target(s: NovaState, id?: string): NovaWindow | undefined {
  if (id) return s.windows.find((w) => w.id === id);
  if (s.focus) return s.windows.find((w) => w.id === s.focus);
  return [...s.windows].sort((a, b) => b.z - a.z)[0];
}

function place(s: NovaState, w: number, h: number) {
  const n = s.windows.length;
  const x = 90 + ((n * 46) % 340);
  const y = 70 + ((n * 38) % 220);
  return { x, y, w, h };
}

function appTitle(s: NovaState, app: string): { title: string; w: number; h: number } | null {
  const known = APP_MAP[app];
  if (known) return { title: known.name, w: known.w, h: known.h };
  const made = s.composed.find((c) => c.id === app);
  if (made) return { title: made.name, w: 560, h: 480 };
  return null;
}

/**
 * تنفيذ نداء نظام واحد.
 * دالة نقية: نفس (الحالة، النداء) ينتج دائمًا نفس النتيجة — وهذا شرط الإرجاع الزمني.
 */
export function execute(
  prev: NovaState,
  raw: SyscallCall,
  origin: JournalEntry["origin"] = "user",
  /**
   * هل يُسجّل هذا النداء في السجل؟
   *
   * القاعدة: **النداء الذي يدخل من الموزّع فقط يُسجّل.** كل ما تشتقّه النواة
   * منه — نافذة يفتحها fs.write، أو قاعدة أتمتة يُطلقها — لا يُسجّل، لأن
   * إعادة تشغيل نداء الأب تُنتجه من جديد. لولا هذه القاعدة لكان الفرع
   * محسوبًا مرتين عند الإرجاع الزمني: مرة بنفسه ومرة ضمن أبيه — وهو ما كان
   * يُنتج نافذة مكرّرة عند الرجوع.
   */
  record = true
): ExecResult {
  const checked = validateCall(raw);
  if (!checked.ok) {
    const s = clone(prev);
    if (record) {
      s.seq += 1;
      s.journal = [
        ...s.journal,
        { seq: s.seq, at: Date.now(), call: raw, origin, ok: false, note: checked.error },
      ];
    }
    return { state: s, effects: [], ok: false, note: checked.error };
  }

  const call = checked.call;
  const args = (call.args ?? {}) as Record<string, never>;
  const s = clone(prev);
  const effects: Effect[] = [];
  let note: string | undefined;
  let ok = true;

  switch (call.op) {
    case "win.open": {
      const app = String(args.app);
      const meta = appTitle(s, app);
      if (!meta) {
        ok = false;
        note = `لا يوجد تطبيق باسم ${app}`;
        break;
      }
      const existing = s.windows.find((w) => w.app === app && !args.props);
      if (existing) {
        existing.minimized = false;
        existing.z = ++s.zTop;
        s.focus = existing.id;
        note = "النافذة كانت مفتوحة — رُفعت للأمام";
        break;
      }
      const box = place(s, meta.w, meta.h);
      const win: NovaWindow = {
        id: nid("w"),
        app,
        title: (args.title as string | undefined) ?? meta.title,
        ...box,
        z: ++s.zTop,
        minimized: false,
        maximized: false,
        props: (args.props as Record<string, unknown> | undefined) ?? {},
        bornAt: Date.now(),
      };
      s.windows = [...s.windows, win];
      s.focus = win.id;
      break;
    }

    case "win.close": {
      if (args.all) {
        s.windows = [];
        s.focus = null;
        break;
      }
      const w = target(s, args.id as string | undefined);
      if (!w) {
        ok = false;
        note = "لا نافذة لإغلاقها";
        break;
      }
      s.windows = s.windows.filter((x) => x.id !== w.id);
      s.focus = [...s.windows].sort((a, b) => b.z - a.z)[0]?.id ?? null;
      break;
    }

    case "win.focus": {
      const w = s.windows.find((x) => x.id === String(args.id));
      if (!w) {
        ok = false;
        note = "نافذة غير موجودة";
        break;
      }
      w.minimized = false;
      w.z = ++s.zTop;
      s.focus = w.id;
      break;
    }

    case "win.minimize": {
      if (args.all) {
        s.windows.forEach((w) => (w.minimized = true));
        s.focus = null;
        break;
      }
      const w = target(s, args.id as string | undefined);
      if (!w) {
        ok = false;
        note = "لا نافذة لتصغيرها";
        break;
      }
      w.minimized = true;
      if (s.focus === w.id) s.focus = null;
      break;
    }

    case "win.maximize": {
      const w = target(s, args.id as string | undefined);
      if (!w) {
        ok = false;
        note = "لا نافذة لتكبيرها";
        break;
      }
      if (w.maximized) {
        if (w.restore) Object.assign(w, w.restore);
        w.maximized = false;
      } else {
        w.restore = { x: w.x, y: w.y, w: w.w, h: w.h };
        w.maximized = true;
      }
      w.z = ++s.zTop;
      s.focus = w.id;
      break;
    }

    case "win.move": {
      const w = target(s, args.id as string | undefined);
      if (!w) {
        ok = false;
        note = "لا نافذة لتحريكها";
        break;
      }
      if (typeof args.x === "number") w.x = Math.max(0, args.x as number);
      if (typeof args.y === "number") w.y = Math.max(0, args.y as number);
      if (typeof args.w === "number") w.w = args.w as number;
      if (typeof args.h === "number") w.h = args.h as number;
      w.maximized = false;
      break;
    }

    case "win.arrange": {
      const mode = String(args.mode);
      const live = s.windows.filter((w) => !w.minimized);
      if (live.length === 0) {
        ok = false;
        note = "لا نوافذ للترتيب";
        break;
      }
      const pad = 16;
      const W = typeof args.vw === "number" ? (args.vw as number) : DESK.w;
      const H = typeof args.vh === "number" ? (args.vh as number) : DESK.h;
      if (mode === "grid") {
        const cols = Math.ceil(Math.sqrt(live.length));
        const rows = Math.ceil(live.length / cols);
        const cw = (W - pad * (cols + 1)) / cols;
        const ch = (H - pad * (rows + 1)) / rows;
        live.forEach((w, i) => {
          w.x = pad + (i % cols) * (cw + pad);
          w.y = pad + Math.floor(i / cols) * (ch + pad);
          w.w = cw;
          w.h = ch;
          w.maximized = false;
        });
      } else if (mode === "cascade") {
        live.forEach((w, i) => {
          w.x = 60 + i * 34;
          w.y = 50 + i * 30;
          w.w = Math.min(760, W - 160);
          w.h = Math.min(520, H - 140);
          w.maximized = false;
          w.z = ++s.zTop;
        });
      } else if (mode === "split") {
        const half = (W - pad * 3) / 2;
        live.slice(0, 2).forEach((w, i) => {
          w.x = pad + i * (half + pad);
          w.y = pad;
          w.w = half;
          w.h = H - pad * 2;
          w.maximized = false;
        });
        live.slice(2).forEach((w) => (w.minimized = true));
      } else {
        const keep = target(s, s.focus ?? undefined) ?? live[0];
        s.windows.forEach((w) => {
          if (w.id !== keep.id) w.minimized = true;
        });
        keep.minimized = false;
        keep.restore = { x: keep.x, y: keep.y, w: keep.w, h: keep.h };
        keep.maximized = true;
        keep.z = ++s.zTop;
        s.focus = keep.id;
      }
      break;
    }

    case "fs.write": {
      const p = normalize(String(args.path));
      const content = String(args.content ?? "");
      const tags = (args.tags as string[] | undefined) ?? [];
      const found = s.fs.find((f) => f.path === p);
      if (found) {
        found.content = content;
        found.updatedAt = Date.now();
        if (tags.length) found.tags = Array.from(new Set([...found.tags, ...tags]));
        found.author = origin === "user" ? "user" : origin;
      } else {
        s.fs = [
          ...s.fs,
          {
            id: nid("f"),
            path: p,
            kind: "file",
            content,
            tags,
            mime: p.endsWith(".md") ? "text/markdown" : "text/plain",
            updatedAt: Date.now(),
            author: origin === "user" ? "user" : origin,
          },
        ];
      }
      note = `كُتب ${basename(p)}`;
      if (args.open) {
        const opened = execute(s, { op: "win.open", args: { app: "notes", props: { path: p } } }, "kernel", false);
        Object.assign(s, opened.state);
        effects.push(...opened.effects);
      }
      // القواعد تُطلق على أحداث النظام، لكن لا على ما تكتبه هي: كسر التكرار شرط.
      if (origin !== "automation") {
        const fired = fireAutomations(s, "file-written", { path: p }, (c) => c, false);
        Object.assign(s, fired.state);
        effects.push(...fired.effects);
      }
      break;
    }

    case "fs.delete": {
      const p = normalize(String(args.path));
      const before = s.fs.length;
      s.fs = s.fs.filter((f) => f.path !== p && !f.path.startsWith(`${p}/`));
      if (s.fs.length === before) {
        ok = false;
        note = "المسار غير موجود";
      } else note = `حُذف ${basename(p)}`;
      break;
    }

    case "fs.search": {
      const q = String(args.query);
      const opened = execute(s, { op: "win.open", args: { app: "files", props: { query: q } } }, "kernel", false);
      Object.assign(s, opened.state);
      note = `بحث: ${q}`;
      break;
    }

    case "farm.pulse": {
      const opened = execute(
        s,
        { op: "win.open", args: { app: "pulse", props: { focus: args.focus ?? "all" } } },
        "kernel",
        false
      );
      Object.assign(s, opened.state);
      note = "نبضة المزرعة";
      break;
    }

    case "farm.report": {
      // التقرير يحتاج قراءة من الخادم، فالنواة تطلبه أثرًا وتبقى نقية
      const path = normalize(String(args.path ?? "/تقارير/نبضة-المزرعة.md"));
      effects.push({ kind: "farm-report", path });
      note = "يُجهَّز تقرير المزرعة";
      break;
    }

    case "nav.open": {
      effects.push({ kind: "navigate", route: String(args.route) });
      note = `فتح ${args.route}`;
      break;
    }

    case "theme.set": {
      if (args.mode) s.theme.mode = args.mode as never;
      if (args.accent) s.theme.accent = String(args.accent);
      if (args.wallpaper) s.theme.wallpaper = String(args.wallpaper);
      if (typeof args.motion === "boolean") s.theme.motion = args.motion as boolean;
      if (typeof args.glass === "number") s.theme.glass = args.glass as number;
      break;
    }

    case "notify": {
      push(s, {
        title: String(args.title),
        body: args.body as string | undefined,
        level: (args.level as never) ?? "info",
      });
      break;
    }

    case "agent.spawn": {
      const steps = ((args.steps as string[] | undefined) ?? [
        "تحليل الهدف",
        "جمع السياق من نظام الملفات",
        "التنفيذ",
        "التحقق وكتابة الخلاصة",
      ]).map((label) => ({ label, done: false }));
      const agent = {
        id: nid("ag"),
        name: String(args.name),
        goal: String(args.goal),
        steps,
        state: "running" as const,
        spawnedAt: Date.now(),
        cpu: 4 + Math.round(Math.random() * 20),
      };
      s.agents = [agent, ...s.agents].slice(0, 12);
      effects.push({ kind: "agent-tick", agentId: agent.id });
      note = `أُطلق الوكيل ${agent.name}`;
      break;
    }

    case "agent.step": {
      const a = s.agents.find((x) => x.id === String(args.id));
      if (!a || a.state !== "running") {
        ok = false;
        note = "وكيل غير نشط";
        break;
      }
      const next = a.steps.find((st) => !st.done);
      if (next) next.done = true;
      a.cpu = Math.max(2, a.cpu + (Math.random() > 0.5 ? 6 : -5));
      // آخر خطوة لا تُنهي الوكيل: النواة تطلب عملًا حقيقيًا من الخارج
      // (قراءة الملفات، سؤال العصب) ثم يُقفل بـ agent.finish بتقرير فعلي.
      effects.push(a.steps.every((st) => st.done) ? { kind: "agent-report", agentId: a.id } : { kind: "agent-tick", agentId: a.id });
      break;
    }

    case "agent.finish": {
      const a = s.agents.find((x) => x.id === String(args.id));
      if (!a) {
        ok = false;
        note = "وكيل غير موجود";
        break;
      }
      a.state = "done";
      a.cpu = 0;
      a.steps.forEach((st) => (st.done = true));
      const path = normalize(`/الوكلاء/${a.name}.md`);
      const body = String(args.report);
      const existing = s.fs.find((f) => f.path === path);
      if (existing) {
        existing.content = body;
        existing.updatedAt = Date.now();
      } else {
        s.fs = [
          ...s.fs,
          {
            id: nid("f"),
            path,
            kind: "file",
            content: body,
            tags: ["وكيل", "تقرير", a.name],
            mime: "text/markdown",
            updatedAt: Date.now(),
            author: "agent",
          },
        ];
      }
      const fired = fireAutomations(s, "agent-done", { agent: a.name }, (c) => c, false);
      Object.assign(s, fired.state);
      effects.push(...fired.effects);
      note = `${a.name} أنجز`;
      break;
    }

    case "agent.kill": {
      const a = s.agents.find((x) => x.id === String(args.id));
      if (!a) {
        ok = false;
        note = "وكيل غير موجود";
        break;
      }
      a.state = "failed";
      a.cpu = 0;
      break;
    }

    case "app.compose": {
      const id = nid("app");
      effects.push({ kind: "compose", prompt: String(args.prompt), targetId: id });
      push(s, { title: "جارٍ تكوين تطبيق جديد…", body: String(args.prompt), level: "info" });
      note = "بدأ التوليد";
      break;
    }

    case "app.install": {
      const app = {
        id: String(args.id),
        name: String(args.name),
        icon: String(args.icon),
        prompt: String(args.prompt),
        spec: args.spec,
        createdAt: Date.now(),
        source: (args.source as never) ?? "reflex",
      };
      s.composed = [app, ...s.composed.filter((c) => c.id !== app.id)].slice(0, 20);
      const opened = execute(s, { op: "win.open", args: { app: app.id } }, "kernel", false);
      Object.assign(s, opened.state);
      effects.push(...opened.effects);
      push(s, { title: `تطبيق «${app.name}» جاهز`, body: "ثُبّت في الشريط السفلي", level: "ok" });
      note = `ثُبّت ${app.name}`;
      break;
    }

    case "automation.create": {
      s.automations = [
        {
          id: nid("au"),
          label: String(args.label),
          when: String(args.when),
          then: args.then as unknown as SyscallCall[],
          enabled: true,
          hits: 0,
        },
        ...s.automations,
      ].slice(0, 20);
      note = "قاعدة جديدة نشطة";
      break;
    }

    case "automation.toggle": {
      const a = s.automations.find((x) => x.id === String(args.id));
      if (!a) {
        ok = false;
        note = "قاعدة غير موجودة";
        break;
      }
      a.enabled = !a.enabled;
      break;
    }

    case "say": {
      s.dialog = [...s.dialog, { role: "nova" as const, text: String(args.text), at: Date.now() }].slice(-80);
      break;
    }

    case "clipboard.set": {
      s.clipboard = String(args.text);
      note = "نُسخ إلى الحافظة";
      break;
    }

    case "power": {
      const action = String(args.action);
      if (action === "lock") {
        s.phase = "locked";
      } else if (action === "unlock") {
        s.phase = "live";
      } else if (action === "reboot") {
        const fresh = initialState();
        fresh.fs = s.fs;
        fresh.composed = s.composed;
        fresh.automations = s.automations;
        fresh.theme = s.theme;
        fresh.user = s.user;
        return { state: fresh, effects: [{ kind: "sound", tone: "boot" }], ok: true, note: "إعادة تشغيل" };
      } else {
        const arranged = execute(s, { op: "win.arrange", args: { mode: "focus" } }, "kernel", false);
        Object.assign(s, arranged.state);
        note = "وضع التركيز";
      }
      break;
    }

    case "journal.rewind": {
      // الإرجاع الزمني الحقيقي يُنفّذ في المزوّد لأنه يحتاج نقطة الأساس.
      note = `طلب إرجاع إلى ${args.seq}`;
      break;
    }

    default: {
      ok = false;
      note = `غير منفّذ: ${call.op}`;
    }
  }

  if (record) {
    s.seq += 1;
    s.journal = [...s.journal, { seq: s.seq, at: Date.now(), call, origin, ok, note }].slice(-400);
  }
  return { state: s, effects, ok, note };
}

/** تنفيذ خطة كاملة بالترتيب */
export function executePlan(
  state: NovaState,
  calls: SyscallCall[],
  origin: JournalEntry["origin"],
  record = true
): { state: NovaState; effects: Effect[]; notes: string[] } {
  let cur = state;
  const effects: Effect[] = [];
  const notes: string[] = [];
  for (const c of calls) {
    const r = execute(cur, c, origin, record);
    cur = r.state;
    effects.push(...r.effects);
    if (r.note) notes.push(r.note);
  }
  return { state: cur, effects, notes };
}

/** القواعد الذكية: النواة تسأل عنها عند كل حدث مهم */
export function fireAutomations(
  state: NovaState,
  when: string,
  ctx: Record<string, string> = {},
  /** مُحوّل اختياري: تستخدمه الواجهة لحقن ما لا تعرفه النواة (أبعاد سطح المكتب) */
  transform: (call: SyscallCall) => SyscallCall = (c) => c,
  /** القواعد المُطلَقة من داخل نداء لا تُسجّل: إعادة تشغيل الأب تُطلقها مجددًا */
  record = true
): { state: NovaState; effects: Effect[] } {
  const matching = state.automations.filter((a) => a.enabled && a.when === when);
  if (matching.length === 0) return { state, effects: [] };
  let cur = clone(state);
  const effects: Effect[] = [];
  for (const rule of matching) {
    const idx = cur.automations.findIndex((a) => a.id === rule.id);
    if (idx >= 0) cur.automations[idx] = { ...cur.automations[idx], hits: cur.automations[idx].hits + 1 };
    const calls = rule.then.map((c) => ({
      op: c.op,
      args: Object.fromEntries(
        Object.entries(c.args ?? {}).map(([k, v]) => [
          k,
          typeof v === "string" ? v.replace(/\{agent\}/g, ctx.agent ?? "") : v,
        ])
      ),
    }));
    const r = executePlan(cur, calls.map(transform), "automation", record);
    cur = r.state;
    effects.push(...r.effects);
  }
  return { state: cur, effects };
}

/**
 * إعادة تشغيل السجل على نقطة أساس — هذه هي آلة الزمن.
 * تُهمَل نداءات الإرجاع نفسها لتفادي التكرار اللانهائي.
 */
export function replay(baseline: NovaState, journal: JournalEntry[], upto: number): NovaState {
  let cur = clone(baseline);
  for (const entry of journal) {
    if (entry.seq > upto) break;
    if (!entry.ok || entry.call.op === "journal.rewind") continue;
    cur = execute(cur, entry.call, entry.origin).state;
  }
  cur.phase = "live";
  return cur;
}

export function appKeys(state: NovaState): string[] {
  return [...APPS.map((a) => a.key), ...state.composed.map((c) => c.id)];
}
