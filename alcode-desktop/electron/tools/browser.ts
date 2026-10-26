import type { Browser } from '../browser/tabs'
import { searchPages } from '../browser/memory'
import { ToolSpec, fail, ok, props } from './types'

/**
 * أدوات المتصفّح — المساعد يقودُه فعلًا لا يشرح لك كيف تقوده.
 *
 * الفرق عن «البحث في الإنترنت»: هذه تعمل على **تبويباتك المفتوحة**،
 * بجلساتك ودخولك. يقرأ ما أمامك، يفتح ويتنقّل، ويقارن بين تبويبين —
 * ولا يرى صفحةً تحتاج تسجيل دخول إلا إن كنت داخلًا فيها أصلًا.
 *
 * ما لا تفعله عمدًا: لا تكتب في الحقول ولا تضغط أزرارًا بلا إذن. الكتابة
 * والنقر خلف تأكيد، لأن صفحةً مفتوحة قد تكون بنكًا أو بريدًا، ونموذجٌ
 * قرأ نصًّا في صفحةٍ لا يُوثق بها قد يُدفَع إلى الضغط على ما لا تريد.
 */
export function browserTools(browser: () => Browser | null): ToolSpec[] {
  const need = (): Browser => {
    const instance = browser()
    if (!instance) throw new Error('المتصفّح غير جاهز — افتح تبويب المتصفّح أولًا.')
    return instance
  }

  return [
    {
      name: 'browser_tabs',
      group: 'المتصفّح',
      danger: 'safe',
      description: 'يسرد التبويبات المفتوحة: رقم كل تبويب وعنوانه ورابطه وأيّها نشط.',
      input: props({}),
      run: async () => {
        const tabs = need().list()
        if (!tabs.length) return ok('ما في تبويبات مفتوحة')
        return ok(
          `${tabs.length} تبويبًا`,
          tabs.map((tab) =>
            `${tab.active ? '● ' : '  '}[${tab.id}] ${tab.title} — ${tab.url}`).join('\n'),
        )
      },
    },
    {
      name: 'browser_open',
      group: 'المتصفّح',
      danger: 'safe',
      description:
        'يفتح رابطًا أو عبارة بحث في تبويب جديد ويعيد رقمه. ' +
        'استعمل browser_read بعده لقراءة ما فُتح.',
      input: props({
        query: { type: 'string', description: 'رابط كامل أو عبارة للبحث' },
      }),
      required: ['query'],
      run: async (input) => {
        const id = need().open(String(input.query))
        return ok(`فتحت تبويبًا [${id}]`, `رقم التبويب ${id}. اقرأه بـ browser_read.`)
      },
    },
    {
      name: 'browser_navigate',
      group: 'المتصفّح',
      danger: 'safe',
      description: 'ينتقل بتبويبٍ قائم إلى عنوان آخر. بلا رقم تبويب يستعمل النشط.',
      input: props({
        query: { type: 'string', description: 'رابط أو عبارة بحث' },
        tab: { type: 'number', description: 'رقم التبويب (اختياري)' },
      }),
      required: ['query'],
      run: async (input) => {
        const id = input.tab === undefined ? undefined : Number(input.tab)
        return need().navigate(String(input.query), id)
          ? ok('انتقلت')
          : fail('ما في تبويب بهذا الرقم.')
      },
    },
    {
      name: 'browser_read',
      group: 'المتصفّح',
      danger: 'safe',
      description:
        'يقرأ نصّ تبويب مفتوح (عنوانه ورابطه ومتنه). بلا رقم تبويب يقرأ النشط. ' +
        'هذه هي الطريقة لترى ما يراه المستخدم على الشاشة.',
      input: props({ tab: { type: 'number', description: 'رقم التبويب (اختياري)' } }),
      run: async (input) => {
        const id = input.tab === undefined ? undefined : Number(input.tab)
        const page = await need().read(id)
        if (!page.text) return fail('الصفحة بلا نصّ يُقرأ — قد تكون صورة أو لم تُحمَّل بعد.')
        return ok(page.title || 'قرأت الصفحة', `${page.title}\n${page.url}\n\n${page.text}`)
      },
    },
    {
      name: 'browser_read_all',
      group: 'المتصفّح',
      danger: 'safe',
      description:
        'يقرأ كل التبويبات المفتوحة دفعةً واحدة — للمقارنة بينها أو تلخيصها معًا. ' +
        'مثال: «قارن بين الأسعار في التبويبات المفتوحة».',
      input: props({}),
      run: async () => {
        const instance = need()
        const tabs = instance.list()
        if (!tabs.length) return fail('ما في تبويبات مفتوحة.')
        const parts: string[] = []
        for (const tab of tabs) {
          const page = await instance.read(tab.id).catch(() => null)
          if (!page?.text) continue
          // حدٌّ لكل تبويب: عشرة تبويبات كاملة تبتلع السياق وتُدفع ثمنًا.
          parts.push(`### [${tab.id}] ${page.title}\n${page.url}\n${page.text.slice(0, 2500)}`)
        }
        if (!parts.length) return fail('لا نصّ في أيٍّ من التبويبات.')
        return ok(`قرأت ${parts.length} تبويبًا`, parts.join('\n\n---\n\n'))
      },
    },
    {
      name: 'browser_history_search',
      group: 'المتصفّح',
      danger: 'safe',
      description:
        'يبحث في نصّ الصفحات التي قرأها المستخدم سابقًا، لا في عناوينها فقط. ' +
        'استعمله حين يسأل «وين قريت عن كذا؟» أو يشير إلى شيء قرأه ولا يذكر مصدره.',
      input: props({ query: { type: 'string', description: 'ما يبحث عنه' } }),
      required: ['query'],
      run: async (input) => {
        const found = await searchPages(String(input.query), 6)
        if (!found.length) return ok('ما لقيت شيئًا في سجلّ القراءة')
        return ok(
          `${found.length} صفحة`,
          found.map((page) =>
            `${page.title}\n${page.url}\n${page.text.slice(0, 400)}`).join('\n\n'),
        )
      },
    },
    {
      name: 'browser_click',
      group: 'المتصفّح',
      danger: 'confirm',
      description:
        'يضغط عنصرًا في الصفحة النشطة بنصّه الظاهر (زرّ أو رابط). ' +
        'يحتاج تأكيد المستخدم لأن الضغط قد يرسل نموذجًا أو يشتري.',
      input: props({ text: { type: 'string', description: 'نصّ الزرّ أو الرابط' } }),
      required: ['text'],
      run: async (input) => {
        const wanted = String(input.text)
        const done = await need().runInPage(`(() => {
          const wanted = ${JSON.stringify(wanted)};
          const nodes = [...document.querySelectorAll('a,button,[role=button],input[type=submit]')];
          const hit = nodes.find((n) => (n.innerText || n.value || '').trim().includes(wanted));
          if (!hit) return false;
          hit.scrollIntoView({ block: 'center' });
          hit.click();
          return true;
        })()`)
        return done ? ok(`ضغطت «${wanted}»`) : fail(`ما لقيت «${wanted}» في الصفحة.`)
      },
    },
    {
      name: 'browser_type',
      group: 'المتصفّح',
      danger: 'confirm',
      description:
        'يكتب نصًّا في حقل في الصفحة النشطة، يُحدَّد بعنوانه أو نصّه الإرشادي. ' +
        'يحتاج تأكيدًا: الحقل قد يكون بحثًا وقد يكون كلمة مرور.',
      input: props({
        field: { type: 'string', description: 'اسم الحقل أو نصّه الإرشادي' },
        value: { type: 'string', description: 'ما يُكتب' },
      }),
      required: ['field', 'value'],
      run: async (input) => {
        const done = await need().runInPage(`(() => {
          const label = ${JSON.stringify(String(input.field))};
          const value = ${JSON.stringify(String(input.value))};
          const fields = [...document.querySelectorAll('input,textarea')];
          const hit = fields.find((f) =>
            (f.placeholder || f.name || f.getAttribute('aria-label') || '').includes(label));
          if (!hit) return false;
          // الحقول السرّية لا تُملأ آليًا مهما طُلب.
          if (hit.type === 'password') return 'password';
          const setter = Object.getOwnPropertyDescriptor(
            hit.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype, 'value').set;
          setter.call(hit, value);
          hit.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`)
        if (done === 'password') return fail('لا أكتب في حقول كلمات المرور.')
        return done ? ok('كتبت في الحقل') : fail('ما لقيت الحقل.')
      },
    },
    {
      name: 'browser_back',
      group: 'المتصفّح',
      danger: 'safe',
      description: 'يرجع خطوة في التبويب النشط.',
      input: props({}),
      run: async () => { need().back(); return ok('رجعت') },
    },
  ]
}
