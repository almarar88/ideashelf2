import { Notification } from 'electron'
import { runPs, runPsJson } from '../ps'
import { ToolSpec, fail, ok, props } from './types'

/** الشبكة، المهام المجدولة، الإشعارات، ومنفذ PowerShell الحرّ. */

export const automationTools: ToolSpec[] = [
  {
    name: 'network_info',
    group: 'الشبكة',
    danger: 'safe',
    description:
      'حالة الاتصال: اسم شبكة الواي فاي، قوة الإشارة، عنوان IP المحلي والعام، ونوع الاتصال.',
    input: props({}),
    run: async () => {
      const script = `
$wifi = netsh wlan show interfaces 2>$null | Out-String
$ssid = ($wifi | Select-String "^\\s*SSID\\s*:\\s*(.+)$").Matches.Groups[1].Value
$signal = ($wifi | Select-String "Signal\\s*:\\s*(.+)$").Matches.Groups[1].Value
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } |
  Select-Object -First 1).IPAddress
$adapter = (Get-NetAdapter -ErrorAction SilentlyContinue |
  Where-Object Status -eq "Up" | Select-Object -First 1).Name
[pscustomobject]@{ ssid = $ssid; signal = $signal; ip = $ip; adapter = $adapter } |
  ConvertTo-Json -Compress`
      const { data } = await runPsJson<{
        ssid: string; signal: string; ip: string; adapter: string
      }>(script)
      if (!data) return fail('تعذّرت قراءة حالة الشبكة.')
      const parts = [
        data.ssid ? `الشبكة: ${data.ssid.trim()}` : null,
        data.signal ? `الإشارة: ${data.signal.trim()}` : null,
        data.ip ? `IP المحلي: ${data.ip}` : null,
        data.adapter ? `المحوّل: ${data.adapter}` : null,
      ].filter(Boolean)
      return ok(
        data.ssid ? `📶 ${data.ssid.trim()} · ${data.signal?.trim() ?? ''}` : '🌐 متصل',
        parts.join('\n') || 'لا اتصال ظاهر.',
      )
    },
  },

  {
    name: 'list_wifi',
    group: 'الشبكة',
    danger: 'safe',
    description:
      'يعرض شبكات الواي فاي المتاحة حولك مع قوة إشارة كل واحدة. ' +
      'مفيد عند «ليش النت بطيء؟» أو للبحث عن شبكة أقوى.',
    input: props({}),
    run: async () => {
      const r = await runPs('netsh wlan show networks mode=bssid | Select-String "SSID|Signal"', {}, 30_000)
      return r.ok && r.stdout
        ? ok('📶 الشبكات المتاحة', r.stdout.slice(0, 1500))
        : fail('تعذّر البحث عن الشبكات — تأكّد أن الواي فاي مشغّل.')
    },
  },

  {
    name: 'toggle_wifi',
    group: 'الشبكة',
    danger: 'confirm',
    description:
      'يشغّل محوّل الواي فاي أو يوقفه. قد يطلب ويندوز صلاحية مدير على بعض الأجهزة.',
    input: props({ on: { type: 'boolean', description: 'true للتشغيل، false للإيقاف' } }),
    required: ['on'],
    run: async (input) => {
      const on = input.on === true
      const script = `
$a = Get-NetAdapter -ErrorAction Stop | Where-Object {
  $_.InterfaceDescription -match "Wi-?Fi|Wireless|802\\.11"
} | Select-Object -First 1
if (-not $a) { throw "no-adapter" }
if ($env:ALC_ON -eq "true") { Enable-NetAdapter -Name $a.Name -Confirm:$false }
else { Disable-NetAdapter -Name $a.Name -Confirm:$false }`
      const r = await runPs(script, { on: on ? 'true' : 'false' })
      if (!r.ok) {
        return fail(
          r.stderr.includes('no-adapter')
            ? 'ما لقيت محوّل واي فاي على هذا الجهاز.'
            : 'تعذّر التبديل — يحتاج تشغيل التطبيق بصلاحية مدير.',
        )
      }
      return ok(on ? '📶 شغّلت الواي فاي' : '📴 أوقفت الواي فاي')
    },
  },

  {
    name: 'schedule_task',
    group: 'الأتمتة',
    danger: 'confirm',
    description:
      'يجدول تشغيل برنامج أو ملف في وقت محدّد عبر جدولة مهام ويندوز — ' +
      'يعمل حتى لو كان Alcode مغلقًا. للتذكيرات داخل التطبيق استعمل add_reminder.',
    input: props({
      name: { type: 'string', description: 'اسم المهمة' },
      command: { type: 'string', description: 'البرنامج أو الملف المراد تشغيله' },
      time: { type: 'string', description: 'الوقت بصيغة HH:mm' },
      daily: { type: 'boolean', description: 'true لتتكرّر يوميًا' },
    }),
    required: ['name', 'command', 'time'],
    run: async (input) => {
      const time = String(input.time).trim()
      if (!/^\d{1,2}:\d{2}$/.test(time)) return fail('الوقت يجب أن يكون بصيغة HH:mm.')
      const script = `
$action = New-ScheduledTaskAction -Execute $env:ALC_COMMAND
$trigger = if ($env:ALC_DAILY -eq "true") {
  New-ScheduledTaskTrigger -Daily -At $env:ALC_TIME
} else {
  New-ScheduledTaskTrigger -Once -At $env:ALC_TIME
}
Register-ScheduledTask -TaskName $env:ALC_NAME -Action $action -Trigger $trigger -Force | Out-Null`
      const r = await runPs(script, {
        name: String(input.name), command: String(input.command),
        time, daily: input.daily ? 'true' : 'false',
      })
      return r.ok
        ? ok(`⏰ جدولت «${input.name}» الساعة ${time}${input.daily ? ' يوميًا' : ''}`)
        : fail(`تعذّرت الجدولة: ${r.stderr.slice(0, 200)}`)
    },
  },

  {
    name: 'list_scheduled_tasks',
    group: 'الأتمتة',
    danger: 'safe',
    description:
      'يعرض المهام المجدولة في جدولة مهام ويندوز مع حالة كل واحدة. ' +
      'استعمله قبل حذف مهمة أو عند «شو مجدول عندي؟».',
    input: props({}),
    run: async () => {
      const script = `
@(Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskPath -eq "\\" -and $_.State -ne "Disabled" } |
  Select-Object -First 25 | ForEach-Object {
    [pscustomobject]@{ name = $_.TaskName; state = [string]$_.State }
  }) | ConvertTo-Json -Depth 3 -Compress`
      const { data } = await runPsJson<{ name: string; state: string }[]>(script, {}, 40_000)
      const list = Array.isArray(data) ? data : data ? [data] : []
      if (!list.length) return ok('ما في مهام مجدولة.')
      return ok(`⏰ ${list.length} مهمة`, list.map((t) => `• ${t.name} — ${t.state}`).join('\n'))
    },
  },

  {
    name: 'delete_scheduled_task',
    group: 'الأتمتة',
    danger: 'confirm',
    description:
      'يحذف مهمة من جدولة مهام ويندوز باسمها. ' +
      'اقرأ القائمة أولًا بـ list_scheduled_tasks لتعرف الاسم الصحيح.',
    input: props({ name: { type: 'string', description: 'اسم المهمة' } }),
    required: ['name'],
    run: async (input) => {
      const r = await runPs(
        'Unregister-ScheduledTask -TaskName $env:ALC_NAME -Confirm:$false',
        { name: String(input.name) },
      )
      return r.ok ? ok(`🗑️ حذفت المهمة «${input.name}»`) : fail('ما لقيت مهمة بهذا الاسم.')
    },
  },

  {
    name: 'notify',
    group: 'الأتمتة',
    danger: 'safe',
    description:
      'يعرض إشعار ويندوز. استعمله للتنبيه على شيء أنجزته أو لتذكير فوري.',
    input: props({
      title: { type: 'string', description: 'العنوان' },
      body: { type: 'string', description: 'النص' },
    }),
    required: ['title', 'body'],
    run: async (input) => {
      if (!Notification.isSupported()) return fail('الإشعارات غير مدعومة هنا.')
      new Notification({ title: String(input.title), body: String(input.body) }).show()
      return ok('🔔 أرسلت الإشعار')
    },
  },

  {
    name: 'open_settings',
    group: 'النظام',
    danger: 'safe',
    description:
      'يفتح صفحة معيّنة من إعدادات ويندوز مباشرة: الشبكة، البلوتوث، الصوت، الشاشة، ' +
      'التحديثات، التطبيقات، الطاقة، الخصوصية، أو صفحة الإعدادات الرئيسية.',
    input: props({
      page: {
        type: 'string',
        description:
          'إحدى: network أو bluetooth أو sound أو display أو update أو apps أو power أو privacy أو home',
        enum: ['network', 'bluetooth', 'sound', 'display', 'update', 'apps', 'power', 'privacy', 'home'],
      },
    }),
    required: ['page'],
    run: async (input) => {
      const map: Record<string, string> = {
        network: 'ms-settings:network',
        bluetooth: 'ms-settings:bluetooth',
        sound: 'ms-settings:sound',
        display: 'ms-settings:display',
        update: 'ms-settings:windowsupdate',
        apps: 'ms-settings:appsfeatures',
        power: 'ms-settings:powersleep',
        privacy: 'ms-settings:privacy',
        home: 'ms-settings:',
      }
      const uri = map[String(input.page)] ?? 'ms-settings:'
      const r = await runPs('Start-Process $env:ALC_URI', { uri })
      return r.ok ? ok(`⚙️ فتحت إعدادات ${input.page}`) : fail(`تعذّر الفتح: ${r.stderr}`)
    },
  },

  {
    name: 'run_powershell',
    group: 'متقدّم',
    danger: 'high',
    description:
      'ينفّذ أمر PowerShell حرًّا حين لا تكفي الأدوات الأخرى — وهذا نادر، فجرّبها أولًا. ' +
      'أمر واحد واضح لا سكربتًا طويلًا، ولا تستعمله لتجاوز حماية أداة أخرى ' +
      '(الحذف النهائي، مسارات النظام، تعطيل الحماية). المستخدم يرى الأمر ويوافق عليه قبل تشغيله.',
    input: props({
      command: { type: 'string', description: 'أمر PowerShell' },
      why: { type: 'string', description: 'سبب الحاجة إليه بجملة قصيرة يقرأها المستخدم' },
    }),
    required: ['command', 'why'],
    run: async (input) => {
      const command = String(input.command)
      // خطوط حمراء لا يمرّ عبرها المنفذ الحرّ مهما كان السياق.
      const banned: [RegExp, string][] = [
        [/format\s+[a-z]:/i, 'تهيئة قرص'],
        [/remove-item[^\n]*\b(c:\\?|c:\\windows|system32)/i, 'حذف من مسار نظام'],
        [/\b(vssadmin|bcdedit|diskpart)\b/i, 'تعديل الإقلاع أو النسخ الاحتياطية'],
        [/set-mppreference[^\n]*disable/i, 'تعطيل حماية ويندوز'],
        [/\b(cipher\s+\/w|sdelete)\b/i, 'محو نهائي لا يُسترجع'],
        [/invoke-(expression|webrequest)[^\n]*http/i, 'تنزيل سكربت من الإنترنت وتشغيله'],
        [/iex\s*\(/i, 'تنفيذ نصّ غير معروف'],
      ]
      const hit = banned.find(([re]) => re.test(command))
      if (hit) {
        return fail(
          `لن أنفّذ هذا: يتضمّن ${hit[1]}. ` +
            'اطلب من المستخدم تنفيذه بنفسه إن كان يقصده فعلًا.',
        )
      }

      const r = await runPs(command, {}, 60_000)
      const out = (r.stdout || r.stderr).slice(0, 4000)
      return r.ok
        ? ok('⚡ نفّذت الأمر', out || 'نُفِّذ بلا مخرجات.')
        : fail(`فشل الأمر: ${out}`)
    },
  },
]
