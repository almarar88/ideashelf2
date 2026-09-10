import { shell } from 'electron'
import { runPs, runPsJson } from '../ps'
import { ToolSpec, fail, ok, props } from './types'

/** التطبيقات والعمليات: فتح، إغلاق، تثبيت، إزالة. */

interface AppEntry { name: string; id: string }

export const appTools: ToolSpec[] = [
  {
    name: 'open_app',
    group: 'التطبيقات',
    danger: 'safe',
    description:
      'يفتح أي برنامج على الجهاز بالاسم: كروم، وورد، الآلة الحاسبة، الإعدادات، ' +
      'مستكشف الملفات… يبحث في قائمة ابدأ وتطبيقات المتجر معًا.',
    input: props({ name: { type: 'string', description: 'اسم البرنامج' } }),
    required: ['name'],
    run: async (input) => {
      // نبحث في مجلد التطبيقات (يشمل تطبيقات المتجر) ثم في اختصارات قائمة ابدأ.
      const script = `
$q = $env:ALC_NAME
$apps = Get-ChildItem "shell:AppsFolder" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "*$q*" } | Select-Object -First 1
if ($apps) {
  $shellApp = New-Object -ComObject Shell.Application
  $folder = $shellApp.Namespace("shell:AppsFolder")
  $item = $folder.Items() | Where-Object { $_.Name -eq $apps.Name } | Select-Object -First 1
  if ($item) { $item.InvokeVerb("Open"); "opened:" + $apps.Name; exit }
}
$lnk = Get-ChildItem -Path "$env:ProgramData\\Microsoft\\Windows\\Start Menu",
  "$env:AppData\\Microsoft\\Windows\\Start Menu" -Recurse -Filter *.lnk -ErrorAction SilentlyContinue |
  Where-Object { $_.BaseName -like "*$q*" } | Select-Object -First 1
if ($lnk) { Start-Process -FilePath $lnk.FullName; "opened:" + $lnk.BaseName; exit }
Start-Process $q
"opened:$q"`
      const r = await runPs(script, { name: String(input.name) })
      if (!r.ok) return fail(`ما لقيت برنامجًا اسمه «${input.name}».`)
      const opened = r.stdout.split('opened:').pop()?.trim() || String(input.name)
      return ok(`▶️ فتحت ${opened}`)
    },
  },

  {
    name: 'list_apps',
    group: 'التطبيقات',
    danger: 'safe',
    description: 'يعرض البرامج المثبّتة على الجهاز. مرّر filter لتصفية الأسماء.',
    input: props({ filter: { type: 'string', description: 'كلمة للتصفية (اختياري)' } }),
    run: async (input) => {
      const script = `
$f = $env:ALC_FILTER
$paths = @(
  "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
$apps = Get-ItemProperty $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
  ForEach-Object { [pscustomobject]@{ name = $_.DisplayName; id = $_.PSChildName } } |
  Sort-Object name -Unique
if ($f) { $apps = $apps | Where-Object { $_.name -like "*$f*" } }
@($apps) | ConvertTo-Json -Depth 3 -Compress`
      const { ok: fine, data, error } = await runPsJson<AppEntry[] | AppEntry>(
        script, { filter: String(input.filter ?? '') }, 40_000,
      )
      if (!fine) return fail(`تعذّرت قراءة القائمة: ${error}`)
      const list = (Array.isArray(data) ? data : data ? [data] : []).slice(0, 120)
      if (!list.length) return ok('ما في برامج مطابقة.')
      return ok(
        `📦 ${list.length} برنامج`,
        list.map((a) => a.name).join('، '),
      )
    },
  },

  {
    name: 'list_processes',
    group: 'التطبيقات',
    danger: 'safe',
    description:
      'يعرض أكثر العمليات استهلاكًا للذاكرة والمعالج الآن. ' +
      'يجيب عن «شو اللي يبطّئ الجهاز؟» و«شو شغّال؟».',
    input: props({ count: { type: 'integer', description: 'العدد المطلوب (افتراضي ١٢)' } }),
    run: async () => {
      const script = `
@(Get-Process | Where-Object { $_.MainWindowTitle -or $_.WorkingSet64 -gt 100MB } |
  Sort-Object WorkingSet64 -Descending | Select-Object -First 14 |
  ForEach-Object { [pscustomobject]@{
    name = $_.ProcessName
    id = $_.Id
    ramMb = [math]::Round($_.WorkingSet64 / 1MB)
    title = $_.MainWindowTitle
  } }) | ConvertTo-Json -Depth 3 -Compress`
      const { ok: fine, data, error } =
        await runPsJson<{ name: string; id: number; ramMb: number; title: string }[]>(script)
      if (!fine || !data) return fail(`تعذّرت قراءة العمليات: ${error}`)
      const list = Array.isArray(data) ? data : [data]
      return ok(
        `⚙️ ${list.length} عملية`,
        list.map((p) => `${p.name} (${p.id}) — ${p.ramMb} ميجا${p.title ? ` · ${p.title}` : ''}`)
          .join('\n'),
      )
    },
  },

  {
    name: 'close_app',
    group: 'التطبيقات',
    danger: 'confirm',
    description:
      'يغلق برنامجًا بالاسم إغلاقًا لطيفًا (يتيح له حفظ عمله). ' +
      'استعمل force حين لا يستجيب — لكن العمل غير المحفوظ يضيع حينها.',
    input: props({
      name: { type: 'string', description: 'اسم البرنامج أو العملية' },
      force: { type: 'boolean', description: 'إنهاء قسري إن لم يستجب' },
    }),
    required: ['name'],
    run: async (input) => {
      const script = `
$q = $env:ALC_NAME -replace '\\.exe$',''
$procs = @(Get-Process -Name $q -ErrorAction SilentlyContinue)
if (-not $procs) { $procs = @(Get-Process | Where-Object { $_.MainWindowTitle -like "*$q*" }) }
if (-not $procs) { throw "not-found" }
foreach ($p in $procs) {
  if ($env:ALC_FORCE -eq "true") { Stop-Process -Id $p.Id -Force }
  else { $null = $p.CloseMainWindow(); Start-Sleep -Milliseconds 400 }
}
$procs.Count`
      const r = await runPs(script, {
        name: String(input.name), force: input.force ? 'true' : 'false',
      })
      if (!r.ok) return fail(`ما لقيت برنامجًا شغّالًا باسم «${input.name}».`)
      return ok(`✖️ أغلقت ${input.name}`)
    },
  },

  {
    name: 'kill_process',
    group: 'التطبيقات',
    danger: 'high',
    description:
      'ينهي عملية بالمعرّف فورًا وبلا حفظ. للحالات التي علّق فيها برنامج تمامًا. ' +
      'لا تستعمله على عمليات النظام.',
    input: props({ pid: { type: 'integer', description: 'معرّف العملية' } }),
    required: ['pid'],
    run: async (input) => {
      const pid = Number(input.pid)
      // إنهاء عمليات النظام يُسقط الجلسة أو يعيد التشغيل — نمنعها صراحةً.
      const protectedNames = ['system', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'smss']
      const check = await runPsJson<{ name: string }>(
        '(Get-Process -Id ([int]$env:ALC_PID) | Select-Object -Property @{n="name";e={$_.ProcessName}}) | ConvertTo-Json -Compress',
        { pid },
      )
      const name = (check.data?.name || '').toLowerCase()
      if (protectedNames.includes(name)) {
        return fail(`«${name}» عملية نظام أساسية — إنهاؤها يُسقط الجلسة. لن أفعلها.`)
      }
      const r = await runPs('Stop-Process -Id ([int]$env:ALC_PID) -Force', { pid })
      return r.ok ? ok(`⛔ أنهيت العملية ${pid}${name ? ` (${name})` : ''}`)
        : fail(`تعذّر الإنهاء: ${r.stderr}`)
    },
  },

  {
    name: 'install_app',
    group: 'التطبيقات',
    danger: 'high',
    description:
      'يثبّت برنامجًا عبر winget (مدير حزم ويندوز الرسمي). ' +
      'ابحث أولًا بـ search_app لتعرف المعرّف الصحيح.',
    input: props({ id: { type: 'string', description: 'معرّف الحزمة في winget' } }),
    required: ['id'],
    run: async (input) => {
      const r = await runPs(
        'winget install --id $env:ALC_ID --silent --accept-package-agreements ' +
          '--accept-source-agreements --disable-interactivity',
        { id: String(input.id) },
        180_000,
      )
      return r.ok
        ? ok(`⬇️ ثبّت ${input.id}`, r.stdout.slice(-600))
        : fail(`تعذّر التثبيت: ${r.stderr.slice(0, 300)}`)
    },
  },

  {
    name: 'search_app',
    group: 'التطبيقات',
    danger: 'safe',
    description: 'يبحث عن برنامج في مستودع winget ويعيد المعرّفات المتاحة للتثبيت.',
    input: props({ query: { type: 'string', description: 'اسم البرنامج' } }),
    required: ['query'],
    run: async (input) => {
      const r = await runPs(
        'winget search $env:ALC_QUERY --accept-source-agreements | Select-Object -First 14',
        { query: String(input.query) },
        60_000,
      )
      return r.ok && r.stdout
        ? ok(`🔎 نتائج winget لـ «${input.query}»`, r.stdout.slice(0, 1500))
        : fail('ما لقيت نتائج، أو winget غير مثبّت على هذا الجهاز.')
    },
  },

  {
    name: 'uninstall_app',
    group: 'التطبيقات',
    danger: 'high',
    description: 'يزيل برنامجًا مثبّتًا. عملية لا رجعة فيها — تأكّد من الاسم أولًا.',
    input: props({ name: { type: 'string', description: 'اسم البرنامج كما يظهر في القائمة' } }),
    required: ['name'],
    run: async (input) => {
      const r = await runPs(
        'winget uninstall --name $env:ALC_NAME --silent --disable-interactivity',
        { name: String(input.name) },
        180_000,
      )
      return r.ok
        ? ok(`🗑️ أزلت ${input.name}`)
        : fail(`تعذّرت الإزالة: ${r.stderr.slice(0, 300)}`)
    },
  },

  {
    name: 'open_url',
    group: 'التطبيقات',
    danger: 'safe',
    description:
      'يفتح رابطًا في المتصفّح الافتراضي. للبحث في الإنترنت استعمل web_search بدلًا منه — ' +
      'هذه لفتح صفحة يراها المستخدم، لا لجلب معلومة تقرأها أنت.',
    input: props({ url: { type: 'string', description: 'الرابط' } }),
    required: ['url'],
    run: async (input) => {
      const raw = String(input.url).trim()
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      // نمنع مخطّطات غير الويب: file: و javascript: تفتح أبوابًا لا نريدها.
      if (!/^https?:\/\//i.test(url)) return fail('أفتح روابط الويب فقط.')
      await shell.openExternal(url)
      return ok(`🌐 فتحت ${url}`)
    },
  },
]
