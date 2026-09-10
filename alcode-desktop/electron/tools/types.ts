/**
 * تعريف أداة واحدة كما يراها النموذج وكما ينفّذها التطبيق.
 */
export interface ToolResult {
  ok: boolean
  /** سطر قصير يُعرض في المحادثة. */
  display: string
  /** ما يُعاد إلى النموذج — قد يكون أطول. */
  detail: string
  /** صورة بترميز base64 (PNG/JPEG) حين تكون النتيجة مرئية. */
  imageBase64?: string
  imageMedia?: 'image/png' | 'image/jpeg'
}

export type Danger = 'safe' | 'confirm' | 'high'

export interface ToolSpec {
  name: string
  description: string
  /** مخطّط JSON لمدخلات الأداة. */
  input: Record<string, unknown>
  required?: string[]
  /**
   * مستوى الخطر:
   *  safe    — لا رجعة فيه ولا ضرر (قراءة، فتح تطبيق).
   *  confirm — يغيّر شيئًا يمكن التراجع عنه (نقل ملف، إغلاق نافذة).
   *  high    — قد يفقد بيانات أو يوقف الجهاز (حذف، إيقاف تشغيل، PowerShell حرّ).
   */
  danger: Danger
  /** مجموعة العرض في شاشة القدرات. */
  group: string
  run: (input: Record<string, any>) => Promise<ToolResult>
}

export const ok = (display: string, detail?: string): ToolResult => ({
  ok: true, display, detail: detail ?? display,
})

export const fail = (reason: string): ToolResult => ({
  ok: false, display: reason, detail: reason,
})

export const image = (
  display: string,
  detail: string,
  imageBase64: string,
  imageMedia: 'image/png' | 'image/jpeg' = 'image/png',
): ToolResult => ({ ok: true, display, detail, imageBase64, imageMedia })

/** مختصر لبناء مخطّط مدخلات. */
export function props(
  entries: Record<string, { type: string; description: string; enum?: string[] }>,
): Record<string, unknown> {
  return entries
}
