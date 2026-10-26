/**
 * ما يُكتب في شريط العنوان: عنوانٌ أم بحث؟
 *
 * هذا القرار يُخطئ فيه كثيرٌ من المتصفّحات بطرفين: فيبحث عمّا هو عنوان
 * واضح، أو يحاول فتح عبارةٍ عربية كأنها نطاق. القاعدة هنا صريحة ومختبَرة،
 * ومنفصلة عن إلكترون حتى تُفحص وحدها.
 */

const HOME = 'about:blank'

/** مخطّطات نسمح بفتحها كما هي. */
const SAFE_SCHEME = /^(https?|about|data|blob):/i
/** أي مخطّط آخر مكتوب صراحةً — file: و javascript: منها — يُرفض. */
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i
/** المضيف المحلّي بمنفذٍ أو بلا، وما بعده مسار. */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?([/?#].*)?$/i
/** اسم نطاق: بلا مسافات، فيه نقطة، ولاحقته حروف. */
const HOSTLIKE = /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i

export function resolveAddress(input: string, search = 'https://duckduckgo.com/?q='): string {
  const text = input.trim()
  if (!text) return HOME

  if (SAFE_SCHEME.test(text)) return text

  /*
   * المضيف المحلّي قبل فحص المخطّط.
   *
   * `localhost:5173` يطابق شكل «مخطّط:» تمامًا كما يطابقه
   * `javascript:` — فلو فُحص المخطّط أوّلًا لرُفض عنوانُ خادم تطوير
   * سليم. الترتيب هنا مقصود، واختبارٌ يثبّته.
   */
  if (LOCAL_HOST.test(text)) return `http://${text}`

  // مخطّط غير مسموح لا يُفتح ولا يُبحث عنه: `javascript:` في شريط العنوان
  // هو الطريق الكلاسيكي لخداع المستخدم بلصق سكربت.
  if (ANY_SCHEME.test(text)) return HOME
  if (HOSTLIKE.test(text)) return `https://${text}`
  return search + encodeURIComponent(text)
}
