/**
 * NOVA OS — أنواع النواة
 *
 * نوفا نظام تشغيل تُقاد كل حالته عبر "نداءات نظام" (syscalls) فقط.
 * لا يوجد أي تعديل مباشر على الحالة في أي مكان آخر، وهذا ما يجعل
 * النظام قابلًا للتسجيل، والإرجاع الزمني، والقيادة بالذكاء الاصطناعي.
 */

export type ThemeMode = "night" | "dawn";

export type NovaTheme = {
  mode: ThemeMode;
  accent: string;
  wallpaper: string;
  motion: boolean;
  glass: number;
};

export type NovaWindow = {
  id: string;
  app: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** لقطة الأبعاد قبل التكبير لاستعادتها */
  restore?: { x: number; y: number; w: number; h: number };
  props: Record<string, unknown>;
  bornAt: number;
};

export type FsNode = {
  id: string;
  path: string;
  kind: "dir" | "file";
  content: string;
  tags: string[];
  mime: string;
  updatedAt: number;
  /** من أنشأ العقدة: المستخدم أم النواة أم وكيل */
  author: string;
};

export type NovaNotification = {
  id: string;
  title: string;
  body?: string;
  level: "info" | "ok" | "warn" | "error";
  at: number;
  read: boolean;
};

export type AgentStep = {
  label: string;
  done: boolean;
};

export type NovaAgent = {
  id: string;
  name: string;
  goal: string;
  steps: AgentStep[];
  state: "running" | "done" | "failed";
  spawnedAt: number;
  cpu: number;
};

export type Automation = {
  id: string;
  label: string;
  when: string;
  then: SyscallCall[];
  enabled: boolean;
  hits: number;
};

export type JournalEntry = {
  seq: number;
  at: number;
  call: SyscallCall;
  origin: "user" | "neural" | "reflex" | "agent" | "automation" | "kernel";
  ok: boolean;
  note?: string;
};

export type SyscallCall = {
  op: string;
  args?: Record<string, unknown>;
};

export type ComposedApp = {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  spec: unknown;
  createdAt: number;
  source: "neural" | "reflex";
};

export type NovaState = {
  version: number;
  phase: "boot" | "locked" | "live";
  user: { name: string; handle: string };
  theme: NovaTheme;
  windows: NovaWindow[];
  focus: string | null;
  zTop: number;
  fs: FsNode[];
  notifications: NovaNotification[];
  journal: JournalEntry[];
  seq: number;
  agents: NovaAgent[];
  automations: Automation[];
  composed: ComposedApp[];
  clipboard: string;
  /** إحصاءات طبقة الذكاء */
  cortex: {
    backend: "neural" | "reflex";
    calls: number;
    lastLatency: number;
    lastIntent: string;
  };
  /** حوار الأوراكل — مشترك بين التطبيقات وشريط النية */
  dialog: { role: "user" | "nova"; text: string; at: number; meta?: string }[];
};

/** نتيجة تنفيذ نداء النظام: حالة جديدة + آثار جانبية للمتصفح */
export type Effect =
  | { kind: "compose"; prompt: string; targetId: string }
  | { kind: "agent-tick"; agentId: string }
  /** الوكيل أنهى خطواته ويحتاج عملًا حقيقيًا (قراءة ملفات، سؤال العصب) */
  | { kind: "agent-report"; agentId: string }
  | { kind: "sound"; tone: "ok" | "warn" | "boot" }
  /** فتح شاشة من التطبيق المضيف — الخروج من نوفا إلى منتجها */
  | { kind: "navigate"; route: string }
  /** طلب نبضة المزرعة من الخادم ثم كتابتها تقريرًا */
  | { kind: "farm-report"; path: string };

export type ExecResult = {
  state: NovaState;
  effects: Effect[];
  note?: string;
  ok: boolean;
};

export type Plan = {
  say: string;
  calls: SyscallCall[];
  source: "neural" | "reflex";
  latency: number;
  reasoning?: string;
};
