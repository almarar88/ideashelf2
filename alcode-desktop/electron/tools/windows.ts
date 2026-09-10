import { runPs, runPsJson } from '../ps'
import { ToolSpec, fail, ok, props } from './types'

/**
 * إدارة النوافذ وأسطح المكتب الافتراضية.
 *
 * هذا ما يميّز مساعد ويندوز عن مساعد الهاتف: على الهاتف نافذة واحدة،
 * وهنا عشرون — وترتيبها هو نصف العمل اليومي.
 */

const WIN32 = `
Add-Type -Language CSharp -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int t, bool r);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);
}
"@
`

interface WinInfo { handle: string; title: string; pid: number; process: string }

const LIST_SCRIPT = `${WIN32}
$found = New-Object System.Collections.ArrayList
$cb = [Win+EnumProc]{
  param($h, $l)
  if ([Win]::IsWindowVisible($h)) {
    $len = [Win]::GetWindowTextLength($h)
    if ($len -gt 0) {
      $sb = New-Object System.Text.StringBuilder ($len + 2)
      [void][Win]::GetWindowText($h, $sb, $sb.Capacity)
      $pid = 0
      [void][Win]::GetWindowThreadProcessId($h, [ref]$pid)
      $proc = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
      [void]$found.Add([pscustomobject]@{
        handle = $h.ToString(); title = $sb.ToString(); pid = $pid; process = $proc
      })
    }
  }
  return $true
}
[void][Win]::EnumWindows($cb, [IntPtr]::Zero)
@($found) | ConvertTo-Json -Depth 3 -Compress`

async function listWindows(): Promise<WinInfo[]> {
  const { data } = await runPsJson<WinInfo[] | WinInfo>(LIST_SCRIPT)
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

/** مطابقة عربية متسامحة: يكفي أن يحتوي العنوان الكلمة. */
function match(list: WinInfo[], query: string): WinInfo | undefined {
  const q = query.trim().toLowerCase()
  return (
    list.find((w) => w.title.toLowerCase() === q) ??
    list.find((w) => w.title.toLowerCase().includes(q)) ??
    list.find((w) => (w.process || '').toLowerCase().includes(q))
  )
}

/** SW_* من Win32: ٢ تصغير، ٣ تكبير، ٩ استعادة. */
const SHOW: Record<string, number> = { minimize: 2, maximize: 3, restore: 9 }

export const windowTools: ToolSpec[] = [
  {
    name: 'list_windows',
    group: 'النوافذ',
    danger: 'safe',
    description:
      'يعرض كل النوافذ المفتوحة الآن بعناوينها وبرامجها. ' +
      'استعمله قبل أي أمر على نافذة لتعرف ما هو مفتوح فعلًا بدل التخمين.',
    input: props({}),
    run: async () => {
      const list = await listWindows()
      if (!list.length) return ok('ما في نوافذ مفتوحة.')
      return ok(
        `🪟 ${list.length} نافذة مفتوحة`,
        list.map((w) => `• ${w.title} — ${w.process} (${w.pid})`).join('\n'),
      )
    },
  },

  {
    name: 'focus_window',
    group: 'النوافذ',
    danger: 'safe',
    description:
      'ينقل نافذة إلى المقدّمة بعنوانها أو اسم برنامجها. ' +
      'نفّذه دائمًا قبل type_text أو press_keys وإلا ذهبت الكتابة إلى نافذة أخرى.',
    input: props({ title: { type: 'string', description: 'جزء من عنوان النافذة أو اسم البرنامج' } }),
    required: ['title'],
    run: async (input) => {
      const target = match(await listWindows(), String(input.title))
      if (!target) return fail(`ما لقيت نافذة تطابق «${input.title}».`)
      const script = `${WIN32}
$h = [IntPtr]::new([int64]$env:ALC_HANDLE)
[void][Win]::ShowWindow($h, 9)
[void][Win]::SetForegroundWindow($h)`
      const r = await runPs(script, { handle: target.handle })
      return r.ok ? ok(`👉 ${target.title}`) : fail(`تعذّر التبديل: ${r.stderr}`)
    },
  },

  {
    name: 'window_state',
    group: 'النوافذ',
    danger: 'safe',
    description:
      'يصغّر نافذة أو يكبّرها لملء الشاشة أو يعيدها إلى حجمها الأصلي. ' +
      'اعرف العنوان الصحيح من list_windows أولًا.',
    input: props({
      title: { type: 'string', description: 'جزء من عنوان النافذة' },
      state: {
        type: 'string', description: 'إحدى: minimize أو maximize أو restore',
        enum: ['minimize', 'maximize', 'restore'],
      },
    }),
    required: ['title', 'state'],
    run: async (input) => {
      const target = match(await listWindows(), String(input.title))
      if (!target) return fail(`ما لقيت نافذة تطابق «${input.title}».`)
      const code = SHOW[String(input.state)]
      if (!code) return fail('حالة غير معروفة.')
      const script = `${WIN32}
[void][Win]::ShowWindow([IntPtr]::new([int64]$env:ALC_HANDLE), [int]$env:ALC_CODE)`
      const r = await runPs(script, { handle: target.handle, code })
      const label: Record<string, string> = {
        minimize: 'صغّرت', maximize: 'كبّرت', restore: 'استعدت',
      }
      return r.ok ? ok(`🪟 ${label[String(input.state)]} ${target.title}`)
        : fail(`تعذّر التنفيذ: ${r.stderr}`)
    },
  },

  {
    name: 'close_window',
    group: 'النوافذ',
    danger: 'confirm',
    description:
      'يغلق نافذة إغلاقًا لطيفًا — البرنامج يسأل عن الحفظ إن كان فيه عمل غير محفوظ.',
    input: props({ title: { type: 'string', description: 'جزء من عنوان النافذة' } }),
    required: ['title'],
    run: async (input) => {
      const target = match(await listWindows(), String(input.title))
      if (!target) return fail(`ما لقيت نافذة تطابق «${input.title}».`)
      // WM_CLOSE = 0x0010 — إغلاق مهذّب يمرّ عبر البرنامج نفسه.
      const script = `${WIN32}
[void][Win]::PostMessage([IntPtr]::new([int64]$env:ALC_HANDLE), 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`
      const r = await runPs(script, { handle: target.handle })
      return r.ok ? ok(`✖️ أغلقت ${target.title}`) : fail(`تعذّر الإغلاق: ${r.stderr}`)
    },
  },

  {
    name: 'snap_window',
    group: 'النوافذ',
    danger: 'safe',
    description:
      'يرصف نافذة على نصف الشاشة يمينًا أو يسارًا، أو يملأ بها الشاشة. ' +
      'مفيد لترتيب شاشتين جنبًا إلى جنب.',
    input: props({
      title: { type: 'string', description: 'جزء من عنوان النافذة' },
      side: { type: 'string', description: 'إحدى: left أو right أو full', enum: ['left', 'right', 'full'] },
    }),
    required: ['title', 'side'],
    run: async (input) => {
      const target = match(await listWindows(), String(input.title))
      if (!target) return fail(`ما لقيت نافذة تطابق «${input.title}».`)
      const side = String(input.side)
      // نحسب الإحداثيات بأنفسنا بدل محاكاة Win+سهم: تلك تعتمد على إعدادات
      // الرصف وقد تفتح مساعد الرصف بدل أن ترصف مباشرة.
      const script = `${WIN32}
Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$h = [IntPtr]::new([int64]$env:ALC_HANDLE)
[void][Win]::ShowWindow($h, 9)
switch ($env:ALC_SIDE) {
  "left"  { [void][Win]::MoveWindow($h, $area.X, $area.Y, [int]($area.Width / 2), $area.Height, $true) }
  "right" { [void][Win]::MoveWindow($h, $area.X + [int]($area.Width / 2), $area.Y, [int]($area.Width / 2), $area.Height, $true) }
  default { [void][Win]::ShowWindow($h, 3) }
}
[void][Win]::SetForegroundWindow($h)`
      const r = await runPs(script, { handle: target.handle, side })
      const label: Record<string, string> = { left: 'يسار', right: 'يمين', full: 'ملء الشاشة' }
      return r.ok ? ok(`🪟 رصفت ${target.title} — ${label[side]}`) : fail(`تعذّر الرصف: ${r.stderr}`)
    },
  },

  {
    name: 'desktop_action',
    group: 'النوافذ',
    danger: 'safe',
    description:
      'إجراءات سطح المكتب: تصغير كل النوافذ، إظهارها، سطح مكتب افتراضي جديد، ' +
      'أو التنقّل بين أسطح المكتب.',
    input: props({
      action: {
        type: 'string',
        description: 'إحدى: show_desktop أو restore_all أو new_desktop أو next_desktop أو prev_desktop أو task_view',
        enum: ['show_desktop', 'restore_all', 'new_desktop', 'next_desktop', 'prev_desktop', 'task_view'],
      },
    }),
    required: ['action'],
    run: async (input) => {
      const combos: Record<string, string> = {
        show_desktop: '^#d',      // placeholder, replaced below
        restore_all: '',
        new_desktop: '',
        next_desktop: '',
        prev_desktop: '',
        task_view: '',
      }
      void combos
      const action = String(input.action)
      // Shell.Application يوفّر سطح المكتب مباشرة؛ الباقي اختصارات نظام.
      const script = `
Add-Type -AssemblyName System.Windows.Forms
switch ($env:ALC_ACTION) {
  "show_desktop"  { (New-Object -ComObject Shell.Application).MinimizeAll() }
  "restore_all"   { (New-Object -ComObject Shell.Application).UndoMinimizeALL() }
  "new_desktop"   { [System.Windows.Forms.SendKeys]::SendWait("^#d") }
  "next_desktop"  { [System.Windows.Forms.SendKeys]::SendWait("^#{RIGHT}") }
  "prev_desktop"  { [System.Windows.Forms.SendKeys]::SendWait("^#{LEFT}") }
  "task_view"     { [System.Windows.Forms.SendKeys]::SendWait("#{TAB}") }
}`
      const r = await runPs(script, { action })
      const label: Record<string, string> = {
        show_desktop: '🖥️ صغّرت كل النوافذ',
        restore_all: '🪟 أعدت النوافذ',
        new_desktop: '➕ سطح مكتب جديد',
        next_desktop: '➡️ سطح المكتب التالي',
        prev_desktop: '⬅️ سطح المكتب السابق',
        task_view: '🗂️ فتحت عرض المهام',
      }
      return r.ok ? ok(label[action] ?? 'تم') : fail(`تعذّر التنفيذ: ${r.stderr}`)
    },
  },
]
