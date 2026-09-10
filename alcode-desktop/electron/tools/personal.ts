import { randomUUID } from 'node:crypto'
import { Memory, Note, Reminder, stores } from '../store'
import { ToolSpec, fail, ok, props } from './types'

/**
 * بيانات المستخدم داخل التطبيق: ذاكرة، ملاحظات، تذكيرات.
 * لا تحتاج ويندوز ولا أذونات — تعمل حتى على غير ويندوز.
 */

/** ما لا يُحفظ في ملف نصّي على القرص مهما طُلب. */
const FORBIDDEN = [
  'كلمة المرور', 'كلمه المرور', 'الرقم السري', 'password', 'passwd',
  'cvv', 'رمز التحقق', 'otp', 'رقم البطاقة', 'رقم البطاقه', 'iban', 'seed phrase',
]

const norm = (v: string) =>
  v.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')

export const personalTools: ToolSpec[] = [
  {
    name: 'remember_fact',
    group: 'الذاكرة',
    danger: 'safe',
    description:
      'يحفظ معلومة عن المستخدم لتبقى معك في كل محادثة قادمة: تفضيلاته، عمله، ' +
      'أدواته، مساراته المعتادة، أسلوبه المفضّل. احفظ ما ينفع لاحقًا لا تفاصيل عابرة. ' +
      'لا تحفظ كلمات مرور ولا أرقام بطاقات ولا رموز تحقّق مهما طُلب منك.',
    input: props({
      text: { type: 'string', description: 'المعلومة بجملة واحدة' },
      category: { type: 'string', description: 'تصنيف قصير: تفضيل، عمل، أدوات، عام' },
    }),
    required: ['text'],
    run: async (input) => {
      const text = String(input.text ?? '').trim()
      if (text.length < 3) return fail('المعلومة قصيرة جدًا.')
      if (FORBIDDEN.some((f) => norm(text).includes(norm(f)))) {
        return fail('لن أحفظ كلمات المرور والأرقام السرية. استعمل مدير كلمات مرور.')
      }
      const all = await stores.memories.load()
      if (all.some((m) => norm(m.text) === norm(text))) return ok('محفوظة عندي أصلًا.')

      const memory: Memory = {
        id: randomUUID(), text,
        category: String(input.category ?? 'عام').trim() || 'عام',
        createdAt: Date.now(),
      }
      await stores.memories.update((list) => [...list, memory].slice(-150))
      return ok(`🧠 حفظت: ${text}`)
    },
  },

  {
    name: 'recall_facts',
    group: 'الذاكرة',
    danger: 'safe',
    description:
      'يقرأ ما حفظته سابقًا عن المستخدم. استعمله عند «شو تعرف عني؟» أو حين ' +
      'تحتاج تفصيلًا شخصيًا لا تجده في حالة اللحظة. مرّر query للتصفية.',
    input: props({ query: { type: 'string', description: 'كلمة للتصفية (اختياري)' } }),
    run: async (input) => {
      const all = await stores.memories.load()
      if (!all.length) return ok('ما عندي شي محفوظ عن المستخدم بعد.')
      const query = String(input.query ?? '')
      const matched = query ? all.filter((m) => norm(m.text).includes(norm(query))) : all
      if (!matched.length) return ok(`ما لقيت شي عن «${query}».`)
      return ok(
        `🧠 ${matched.length} معلومة`,
        matched.map((m) => `• [${m.category}] ${m.text}`).join('\n'),
      )
    },
  },

  {
    name: 'forget_fact',
    group: 'الذاكرة',
    danger: 'confirm',
    description:
      'يحذف معلومة محفوظة عن المستخدم حين يطلب نسيان شيء عنه. ' +
      'اقرأ الذاكرة أولًا إن لم تكن متأكّدًا من النص.',
    input: props({ query: { type: 'string', description: 'جزء من نصّ المعلومة' } }),
    required: ['query'],
    run: async (input) => {
      const all = await stores.memories.load()
      const target = all.find((m) => norm(m.text).includes(norm(String(input.query))))
      if (!target) return fail(`ما لقيت معلومة تطابق «${input.query}».`)
      await stores.memories.update((list) => list.filter((m) => m.id !== target.id))
      return ok(`نسيت: ${target.text}`)
    },
  },

  {
    name: 'add_note',
    group: 'الملاحظات',
    danger: 'safe',
    description:
      'يحفظ ملاحظة داخل التطبيق: فكرة، قائمة، مقتطف، خلاصة اجتماع. ' +
      'تبقى متاحة لك في المحادثات القادمة عبر read_notes.',
    input: props({
      title: { type: 'string', description: 'عنوان قصير' },
      body: { type: 'string', description: 'النص' },
    }),
    required: ['body'],
    run: async (input) => {
      const note: Note = {
        id: randomUUID(),
        title: String(input.title ?? '').trim(),
        body: String(input.body).trim(),
        createdAt: Date.now(),
      }
      await stores.notes.update((list) => [note, ...list].slice(0, 500))
      return ok(`📝 حفظت الملاحظة${note.title ? `: ${note.title}` : ''}`)
    },
  },

  {
    name: 'read_notes',
    group: 'الملاحظات',
    danger: 'safe',
    description:
      'يقرأ الملاحظات المحفوظة داخل التطبيق. مرّر query للبحث في عناوينها ونصوصها، ' +
      'أو اتركها فارغة لأحدث الملاحظات.',
    input: props({ query: { type: 'string', description: 'كلمة للبحث (اختياري)' } }),
    run: async (input) => {
      const all = await stores.notes.load()
      if (!all.length) return ok('ما في ملاحظات محفوظة.')
      const query = String(input.query ?? '')
      const matched = query
        ? all.filter((n) => norm(n.title + ' ' + n.body).includes(norm(query)))
        : all.slice(0, 20)
      if (!matched.length) return ok(`ما لقيت ملاحظة عن «${query}».`)
      return ok(
        `📝 ${matched.length} ملاحظة`,
        matched.map((n) => `• ${n.title || '(بلا عنوان)'}: ${n.body.slice(0, 300)}`).join('\n'),
      )
    },
  },

  {
    name: 'add_reminder',
    group: 'الأتمتة',
    danger: 'safe',
    description:
      'ينشئ تذكيرًا يظهر كإشعار في وقته ما دام Alcode شغّالًا (ولو في شريط المهام). ' +
      'مرّر الوقت بصيغة HH:mm لليوم، أو YYYY-MM-DD HH:mm لتاريخ محدّد، ' +
      'أو minutes لعدد دقائق من الآن.',
    input: props({
      text: { type: 'string', description: 'نص التذكير' },
      time: { type: 'string', description: 'HH:mm أو YYYY-MM-DD HH:mm' },
      minutes: { type: 'integer', description: 'بعد كم دقيقة من الآن' },
    }),
    required: ['text'],
    run: async (input) => {
      const now = Date.now()
      let at = 0

      if (input.minutes !== undefined && input.minutes !== null) {
        at = now + Math.max(1, Number(input.minutes)) * 60_000
      } else if (input.time) {
        const raw = String(input.time).trim()
        const full = /^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}$/.test(raw)
        const timeOnly = /^\d{1,2}:\d{2}$/.test(raw)
        if (full) {
          at = new Date(raw.replace(' ', 'T')).getTime()
        } else if (timeOnly) {
          const [h, m] = raw.split(':').map(Number)
          const d = new Date()
          d.setHours(h, m, 0, 0)
          // وقت مضى اليوم يعني الغد — وإلا انطلق التذكير فورًا وهو خطأ صامت.
          if (d.getTime() <= now) d.setDate(d.getDate() + 1)
          at = d.getTime()
        }
      }

      if (!at || Number.isNaN(at)) return fail('ما فهمت الوقت. استعمل HH:mm أو minutes.')

      const reminder: Reminder = {
        id: randomUUID(), text: String(input.text), at, done: false,
      }
      await stores.reminders.update((list) => [...list, reminder])
      const when = new Date(at).toLocaleString('ar', { hour12: false })
      return ok(`⏰ ذكّرتك: ${reminder.text} — ${when}`)
    },
  },

  {
    name: 'read_reminders',
    group: 'الأتمتة',
    danger: 'safe',
    description:
      'يعرض التذكيرات القادمة بأوقاتها. استعمله عند «شو عندي اليوم؟» ' +
      'أو قبل إضافة تذكير جديد لتتفادى التكرار.',
    input: props({}),
    run: async () => {
      const all = (await stores.reminders.load()).filter((r) => !r.done)
      if (!all.length) return ok('ما في تذكيرات قادمة.')
      return ok(
        `⏰ ${all.length} تذكير`,
        all
          .sort((a, b) => a.at - b.at)
          .map((r) => `• ${r.text} — ${new Date(r.at).toLocaleString('ar', { hour12: false })}`)
          .join('\n'),
      )
    },
  },
]
