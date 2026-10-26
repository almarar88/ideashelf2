import { stores } from '../store'
import { rank } from '../retrieval'

/**
 * ذاكرة التصفّح — الميزة التي لا يعطيها متصفّح آخر.
 *
 * السجلّ في كل المتصفّحات قائمةُ عناوين: تبحث فيها بكلمة من **العنوان**،
 * فإن لم تتذكّر العنوان ضاعت الصفحة. وما تتذكّره عادةً ليس العنوان بل ما
 * قرأته فيها.
 *
 * هنا يُحفظ **نصّ** كل صفحة تُقرأ، ويُبحث فيه بنفس المطابقة العربية
 * المستعملة في ذاكرة المساعد: تطبيع الهمزات والتشكيل وتجذير خفيف، فـ
 * «أسعار الذهب» تجد صفحةً كتبت «سعر الذّهب». محلّي بالكامل: لا يغادر
 * الجهاز، ولا يُرسل إلى مزوّد، ولا يحتاج إنترنت للبحث فيه.
 */

export interface VisitedPage {
  url: string
  title: string
  /** مقتطف يكفي للبحث والعرض دون أن يُثقل الملفّ. */
  text: string
  at: number
}

/** حدٌّ على الصفحة وعلى السجلّ: الذاكرة ليست أرشيفًا للإنترنت. */
const MAX_TEXT = 4000
const MAX_PAGES = 1500

/** صفحات لا معنى لحفظها: نماذج الدخول وصفحات البنوك والمحلّية. */
function skippable(url: string): boolean {
  return /^(about|data|blob|file|chrome|devtools):/i.test(url) ||
    /\/\/(localhost|127\.0\.0\.1)/i.test(url) ||
    /(login|signin|sign-in|auth|checkout|payment)/i.test(url)
}

export async function rememberPage(page: Omit<VisitedPage, 'at'>): Promise<void> {
  if (skippable(page.url) || !page.text.trim()) return
  const entry: VisitedPage = {
    url: page.url,
    title: page.title.slice(0, 200),
    text: page.text.slice(0, MAX_TEXT),
    at: Date.now(),
  }
  const current = await stores.pages.load()
  // الزيارة المتكرّرة تُحدِّث مكانها ولا تُضاف ثانيةً.
  const without = current.filter((one) => one.url !== entry.url)
  await stores.pages.save([entry, ...without].slice(0, MAX_PAGES))
}

/** يبحث في نصّ ما قرأته، لا في عناوينه فقط. */
export async function searchPages(query: string, limit = 8): Promise<VisitedPage[]> {
  const pages = await stores.pages.load()
  return rank(query, pages, limit, (page) => `${page.title} ${page.text}`, (page) => page.at)
}

export async function recentPages(limit = 30): Promise<VisitedPage[]> {
  return (await stores.pages.load()).slice(0, limit)
}

export async function forgetPages(): Promise<void> {
  await stores.pages.save([])
}
