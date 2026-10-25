/**
 * اقتراحات تقرأ حالتك.
 *
 * القائمة الثابتة تُقرأ مرّة ثم تصير أثاثًا لا يراه أحد. هذه تتغيّر بتغيّر
 * اللحظة: قبل الصلاة تسأل عنها، وفي الصباح تلخّص اليوم، وحين يشتدّ الحرّ
 * تسأل عن الخروج. منطق محلّي خالص — بلا نداء نموذج وبلا تكلفة، وقابل
 * للاختبار بلا تشغيل التطبيق.
 */

export interface Suggestion {
  /** مفتاح ثابت للمقارنة في الاختبار وللـ React key. */
  id: string
  icon: 'mosque' | 'cloud' | 'list' | 'news' | 'sun' | 'grid' | 'search' | 'bolt' | 'clock'
  text: string
}

export interface DayState {
  /** الصلاة القادمة ووقتها بالمللي ثانية. */
  nextPrayer?: { arabic: string; at: number } | null
  tasksOpen?: number
  habitsLeft?: number
  temperature?: number | null
  rainChance?: number | null
  headlines?: number
  hasPlace?: boolean
}

/** اقتراحات عامة تصلح في أي وقت — تملأ ما تبقّى من المواضع. */
const FALLBACK: Suggestion[] = [
  { id: 'tidy', icon: 'grid', text: 'رتّب مجلد التنزيلات' },
  { id: 'screen', icon: 'search', text: 'شو في الشاشة؟' },
  { id: 'status', icon: 'bolt', text: 'شو حالة الجهاز؟' },
  { id: 'water', icon: 'clock', text: 'ذكّرني بعد ٢٠ دقيقة أشرب ماء' },
]

/**
 * يبني الاقتراحات مرتّبة بالأهمية.
 *
 * [now] يُمرَّر لا يُقرأ من الساعة، ليكون الاختبار حتميًا.
 */
export function suggestionsFor(state: DayState, now: number, limit = 4): Suggestion[] {
  const out: Suggestion[] = []
  const hour = new Date(now).getHours()

  // الأقرب زمنًا أولًا: صلاة بعد أقلّ من ساعة هي ما يشغل البال الآن.
  if (state.nextPrayer) {
    const minutes = Math.round((state.nextPrayer.at - now) / 60_000)
    if (minutes > 0 && minutes <= 60) {
      out.push({
        id: 'prayer-soon',
        icon: 'mosque',
        text: `كم باقي على ${state.nextPrayer.arabic}؟`,
      })
    }
  }

  if (hour >= 5 && hour < 11) {
    out.push({ id: 'brief', icon: 'sun', text: 'لخّص لي يومي' })
  }

  // المطر أهمّ من الحرارة: يغيّر قرارك، والحرارة تصفه فقط.
  if ((state.rainChance ?? 0) >= 30) {
    out.push({ id: 'rain', icon: 'cloud', text: 'آخذ مظلّة اليوم؟' })
  } else if ((state.temperature ?? 0) >= 38) {
    out.push({ id: 'hot', icon: 'cloud', text: 'متى يبرد الجو اليوم؟' })
  }

  if ((state.tasksOpen ?? 0) > 0) {
    out.push({ id: 'tasks', icon: 'list', text: 'شو أهم مهمة أبدأ فيها؟' })
  }

  if ((state.headlines ?? 0) > 0 && hour >= 11) {
    out.push({ id: 'news', icon: 'news', text: 'لخّص لي أهم الأخبار' })
  }

  if (!state.hasPlace) {
    // بلا موقع لا صلاة ولا طقس: الاقتراح يدلّ على الحلّ لا على الميزة.
    out.length = 0
    out.push({ id: 'place', icon: 'cloud', text: 'حدّد مدينتي' })
  }

  for (const extra of FALLBACK) {
    if (out.length >= limit) break
    if (!out.some((one) => one.id === extra.id)) out.push(extra)
  }
  return out.slice(0, limit)
}
