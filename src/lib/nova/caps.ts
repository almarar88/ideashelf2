/**
 * نظام الصلاحيات (Capabilities)
 *
 * هذه الطبقة هي الاكتمال المنطقي لمعمار نوفا. جدول نداءات النظام جعل كل
 * قدرة في النظام *مسمّاة*؛ والصلاحيات تجعل كل قدرة *مملوكة*.
 *
 * الفرق الجوهري: التطبيقات المثبّتة **هي** النظام — تعمل بصلاحية المستخدم.
 * أما التطبيقات التي يولّدها الذكاء الاصطناعي فهي كود طرف ثالث كتبه نموذج
 * لغوي من وصف بالكلمات: تبدأ بأقل صلاحية ممكنة، وكل قدرة إضافية تحتاج
 * موافقتك الصريحة مرة واحدة، ويمكنك سحبها في أي وقت.
 *
 * بلا هذه الطبقة كان «اصنع لي تطبيقًا» يعني منح مخرَج نموذج لغوي مفتاح
 * ملفاتك وإعداداتك بلا سؤال.
 */

export type Capability =
  | "windows"
  | "files"
  | "look"
  | "agents"
  | "forge"
  | "rules"
  | "farm"
  | "navigate"
  | "power"
  | "time"
  | "alerts"
  | "clipboard";

export type CapMeta = {
  label: string;
  desc: string;
  risk: "low" | "mid" | "high";
  icon: string;
};

export const CAPS: Record<Capability, CapMeta> = {
  windows: {
    label: "النوافذ",
    desc: "فتح وإغلاق وترتيب نوافذ النظام",
    risk: "low",
    icon: "▭",
  },
  files: {
    label: "الملفات",
    desc: "قراءة محتواك وكتابته وحذفه",
    risk: "high",
    icon: "▤",
  },
  look: {
    label: "المظهر",
    desc: "تغيير الوضع والألوان والخلفية",
    risk: "low",
    icon: "◐",
  },
  agents: {
    label: "الوكلاء",
    desc: "إطلاق مهام تعمل في الخلفية وإيقافها",
    risk: "mid",
    icon: "◎",
  },
  forge: {
    label: "التوليد",
    desc: "توليد تطبيقات جديدة وتثبيتها في النظام",
    risk: "high",
    icon: "✦",
  },
  rules: {
    label: "القواعد",
    desc: "إنشاء أتمتة تعمل تلقائيًا لاحقًا",
    risk: "high",
    icon: "⟐",
  },
  farm: {
    label: "بيانات المزرعة",
    desc: "قراءة أرقام مزرعتك الحقيقية",
    risk: "mid",
    icon: "◉",
  },
  navigate: {
    label: "التنقّل",
    desc: "فتح شاشات التطبيق في تبويب جديد",
    risk: "mid",
    icon: "↗",
  },
  power: {
    label: "الطاقة",
    desc: "قفل الجلسة وإعادة تشغيل النواة",
    risk: "high",
    icon: "⏏",
  },
  time: {
    label: "الزمن",
    desc: "إرجاع النظام إلى حالة سابقة",
    risk: "high",
    icon: "↺",
  },
  alerts: {
    label: "الإشعارات",
    desc: "إظهار إشعارات ورسائل",
    risk: "low",
    icon: "◔",
  },
  clipboard: {
    label: "الحافظة",
    desc: "الكتابة في حافظة النظام",
    risk: "low",
    icon: "⧉",
  },
};

/** صلاحيات التطبيق المولّد عند التثبيت: أدنى ما يجعله مفيدًا */
export const DEFAULT_COMPOSED_CAPS: Capability[] = ["alerts"];

/** ما تملكه التطبيقات المثبّتة: هي النظام نفسه */
export const SYSTEM_CAPS: Capability[] = Object.keys(CAPS) as Capability[];

export function capLabel(cap: Capability): string {
  return CAPS[cap]?.label ?? cap;
}

export function riskTone(risk: CapMeta["risk"]): string {
  return risk === "high" ? "danger" : risk === "mid" ? "warn" : "ok";
}
