import { runPs, runPsJson } from '../ps'
import { ToolSpec, fail, ok, props } from './types'

/**
 * حالة الجهاز والطاقة والصوت والعرض.
 */

interface SysInfo {
  os: string
  cpu: string
  cores: number
  ramTotalGb: number
  ramFreeGb: number
  uptimeHours: number
  battery: number | null
  charging: boolean | null
  disks: { name: string; freeGb: number; totalGb: number }[]
}

export const systemTools: ToolSpec[] = [
  {
    name: 'system_info',
    group: 'النظام',
    danger: 'safe',
    description:
      'حالة الجهاز الكاملة: نظام التشغيل، المعالج، الذاكرة المستخدمة والحرة، ' +
      'مساحة الأقراص، البطارية وحالة الشحن، ومدة التشغيل. ' +
      'استعمله عند «كيف حالة الجهاز؟» أو «ليش الجهاز بطيء؟» أو «كم باقي بطارية؟».',
    input: props({}),
    run: async () => {
      const script = `
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{
    name = $_.DeviceID
    freeGb = [math]::Round($_.FreeSpace / 1GB, 1)
    totalGb = [math]::Round($_.Size / 1GB, 1)
  }
}
[pscustomobject]@{
  os = $os.Caption + " " + $os.Version
  cpu = $cpu.Name.Trim()
  cores = $cpu.NumberOfLogicalProcessors
  ramTotalGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  ramFreeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
  battery = if ($bat) { $bat.EstimatedChargeRemaining } else { $null }
  charging = if ($bat) { $bat.BatteryStatus -eq 2 } else { $null }
  disks = @($disks)
} | ConvertTo-Json -Depth 4 -Compress`

      const { ok: fine, data, error } = await runPsJson<SysInfo>(script)
      if (!fine || !data) return fail(`تعذّرت قراءة حالة الجهاز: ${error}`)

      const usedRam = (data.ramTotalGb - data.ramFreeGb).toFixed(1)
      const lines = [
        `النظام: ${data.os}`,
        `المعالج: ${data.cpu} (${data.cores} نواة منطقية)`,
        `الذاكرة: ${usedRam} من ${data.ramTotalGb} جيجا مستخدمة`,
        `مدة التشغيل: ${data.uptimeHours} ساعة`,
        ...(data.battery !== null
          ? [`البطارية: ${data.battery}٪${data.charging ? ' (تشحن)' : ''}`]
          : []),
        ...data.disks.map(
          (d) => `القرص ${d.name} ${d.freeGb} جيجا حرّة من ${d.totalGb}`,
        ),
      ]
      const short = data.battery !== null
        ? `🔋 ${data.battery}٪ · ذاكرة ${usedRam}/${data.ramTotalGb} جيجا`
        : `💻 ذاكرة ${usedRam}/${data.ramTotalGb} جيجا`
      return ok(short, lines.join('\n'))
    },
  },

  {
    name: 'lock_pc',
    group: 'النظام',
    danger: 'safe',
    description:
      'يقفل الجهاز فورًا وتظهر شاشة تسجيل الدخول. البرامج تبقى شغّالة كما هي، ' +
      'فهو الأنسب حين تترك مكتبك دقائق.',
    input: props({}),
    run: async () => {
      const r = await runPs('rundll32.exe user32.dll,LockWorkStation')
      return r.ok ? ok('🔒 قفلت الجهاز') : fail(`تعذّر القفل: ${r.stderr}`)
    },
  },

  {
    name: 'sleep_pc',
    group: 'النظام',
    danger: 'confirm',
    description:
      'ينقل الجهاز إلى وضع السكون. البرامج المفتوحة تبقى كما هي وتعود عند الاستيقاظ.',
    input: props({}),
    run: async () => {
      const r = await runPs(
        'Add-Type -AssemblyName System.Windows.Forms; ' +
          '[System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)',
      )
      return r.ok ? ok('😴 أدخلت الجهاز في السكون') : fail(`تعذّر السكون: ${r.stderr}`)
    },
  },

  {
    name: 'power_action',
    group: 'النظام',
    danger: 'high',
    description:
      'إيقاف تشغيل الجهاز أو إعادة تشغيله أو تسجيل الخروج، مع تأخير اختياري بالثواني. ' +
      'استعمل cancel لإلغاء إيقاف مجدول لم يبدأ بعد.',
    input: props({
      action: {
        type: 'string',
        description: 'إحدى: shutdown أو restart أو logoff أو cancel',
        enum: ['shutdown', 'restart', 'logoff', 'cancel'],
      },
      delay_seconds: { type: 'integer', description: 'تأخير بالثواني (افتراضي ٣٠ لإتاحة التراجع)' },
    }),
    required: ['action'],
    run: async (input) => {
      const action = String(input.action || '')
      const delay = Math.max(0, Math.min(3600, Number(input.delay_seconds ?? 30)))

      // تأخير افتراضي مقصود: يمنح المستخدم فرصة للتراجع بأمر واحد.
      const map: Record<string, string> = {
        shutdown: `shutdown.exe /s /t ${delay}`,
        restart: `shutdown.exe /r /t ${delay}`,
        logoff: 'shutdown.exe /l',
        cancel: 'shutdown.exe /a',
      }
      const cmd = map[action]
      if (!cmd) return fail(`إجراء غير معروف: ${action}`)

      const r = await runPs(cmd)
      if (!r.ok && action === 'cancel') return fail('ما في إيقاف مجدول لألغيه.')
      if (!r.ok) return fail(`تعذّر التنفيذ: ${r.stderr}`)

      const label: Record<string, string> = {
        shutdown: `سيُغلق الجهاز بعد ${delay} ثانية — قل «ألغِ» لإيقاف ذلك`,
        restart: `سيُعاد التشغيل بعد ${delay} ثانية — قل «ألغِ» لإيقاف ذلك`,
        logoff: 'سجّلت الخروج',
        cancel: 'ألغيت الإيقاف المجدول',
      }
      return ok(label[action])
    },
  },

  {
    name: 'set_volume',
    group: 'الصوت',
    danger: 'safe',
    description: 'يضبط مستوى صوت النظام من ٠ إلى ١٠٠، أو يكتم/يلغي الكتم.',
    input: props({
      percent: { type: 'integer', description: 'المستوى من ٠ إلى ١٠٠' },
      mute: { type: 'boolean', description: 'true للكتم، false لإلغائه' },
    }),
    run: async (input) => {
      // نتحكّم بالصوت عبر واجهة النواة IAudioEndpointVolume: أدقّ من محاكاة
      // مفاتيح رفع/خفض الصوت التي تتحرّك بخطوات ثابتة.
      const script = `
Add-Type -Language CSharp -TypeDefinition @"
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float level, System.Guid ctx);
  int j();
  int GetMasterVolumeLevelScalar(out float level);
  int k(); int l(); int m(); int n();
  int SetMute(bool mute, System.Guid ctx);
  int GetMute(out bool mute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref System.Guid id, int ctx, System.IntPtr p, out IAudioEndpointVolume ep); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    IMMDeviceEnumerator e = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
    IMMDevice dev; e.GetDefaultAudioEndpoint(0, 1, out dev);
    System.Guid g = typeof(IAudioEndpointVolume).GUID;
    IAudioEndpointVolume ep; dev.Activate(ref g, 23, System.IntPtr.Zero, out ep);
    return ep;
  }
  public static float Get() { float v; Vol().GetMasterVolumeLevelScalar(out v); return v; }
  public static void Set(float v) { Vol().SetMasterVolumeLevelScalar(v, System.Guid.Empty); }
  public static bool GetMute() { bool m; Vol().GetMute(out m); return m; }
  public static void SetMute(bool m) { Vol().SetMute(m, System.Guid.Empty); }
}
"@
if ($env:ALC_MUTE -ne "") { [Audio]::SetMute([bool]::Parse($env:ALC_MUTE)) }
if ($env:ALC_PERCENT -ne "") { [Audio]::Set([float]$env:ALC_PERCENT / 100.0) }
[pscustomobject]@{ level = [math]::Round([Audio]::Get() * 100); muted = [Audio]::GetMute() } | ConvertTo-Json -Compress`

      const hasPercent = input.percent !== undefined && input.percent !== null
      const hasMute = input.mute !== undefined && input.mute !== null
      const { ok: fine, data, error } = await runPsJson<{ level: number; muted: boolean }>(
        script,
        {
          percent: hasPercent ? Math.max(0, Math.min(100, Number(input.percent))) : '',
          mute: hasMute ? (input.mute ? 'true' : 'false') : '',
        },
      )
      if (!fine || !data) return fail(`تعذّر ضبط الصوت: ${error}`)
      return ok(
        data.muted ? '🔇 الصوت مكتوم' : `🔊 الصوت ${data.level}٪`,
        `مستوى الصوت الآن ${data.level}٪${data.muted ? ' (مكتوم)' : ''}`,
      )
    },
  },

  {
    name: 'media_control',
    group: 'الصوت',
    danger: 'safe',
    description:
      'يتحكّم بالمشغّل النشط أيًا كان (يوتيوب، سبوتيفاي، أي مشغّل): ' +
      'تشغيل/إيقاف مؤقت، التالي، السابق.',
    input: props({
      action: {
        type: 'string',
        description: 'إحدى: toggle أو next أو previous أو stop',
        enum: ['toggle', 'next', 'previous', 'stop'],
      },
    }),
    required: ['action'],
    run: async (input) => {
      const keys: Record<string, number> = {
        toggle: 0xb3, next: 0xb0, previous: 0xb1, stop: 0xb2,
      }
      const code = keys[String(input.action)]
      if (!code) return fail('إجراء غير معروف.')

      const script = `
Add-Type -Language CSharp -TypeDefinition @"
using System.Runtime.InteropServices;
public class Media {
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, System.UIntPtr e);
  public static void Send(byte k) { keybd_event(k, 0, 0, System.UIntPtr.Zero); keybd_event(k, 0, 2, System.UIntPtr.Zero); }
}
"@
[Media]::Send([byte]$env:ALC_CODE)`
      const r = await runPs(script, { code })
      const label: Record<string, string> = {
        toggle: '⏯️ بدّلت التشغيل', next: '⏭️ التالي',
        previous: '⏮️ السابق', stop: '⏹️ أوقفت التشغيل',
      }
      return r.ok ? ok(label[String(input.action)]) : fail(`تعذّر التحكّم: ${r.stderr}`)
    },
  },

  {
    name: 'set_brightness',
    group: 'العرض',
    danger: 'safe',
    description:
      'يضبط سطوع الشاشة من ٠ إلى ١٠٠. يعمل على شاشات اللابتوب المدمجة؛ ' +
      'الشاشات الخارجية غالبًا لا تستجيب لأن ويندوز لا يتحكّم بسطوعها.',
    input: props({ percent: { type: 'integer', description: 'السطوع من ٠ إلى ١٠٠' } }),
    required: ['percent'],
    run: async (input) => {
      const percent = Math.max(0, Math.min(100, Number(input.percent) || 0))
      const r = await runPs(
        '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods)' +
          '.WmiSetBrightness(1, [int]$env:ALC_PERCENT)',
        { percent },
      )
      return r.ok
        ? ok(`☀️ السطوع ${percent}٪`)
        : fail('تعذّر ضبط السطوع — الشاشة الخارجية لا تدعم تحكّم ويندوز بالسطوع.')
    },
  },

  {
    name: 'set_wallpaper',
    group: 'العرض',
    danger: 'confirm',
    description:
      'يغيّر خلفية سطح المكتب إلى صورة من مسار على الجهاز. ' +
      'ابحث عن الصورة بـ find_files أولًا إن لم تعرف مسارها.',
    input: props({ path: { type: 'string', description: 'المسار الكامل لملف الصورة' } }),
    required: ['path'],
    run: async (input) => {
      const script = `
if (-not (Test-Path -LiteralPath $env:ALC_PATH)) { throw "الملف غير موجود" }
Add-Type -Language CSharp -TypeDefinition @"
using System.Runtime.InteropServices;
public class Wall {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int a, int u, string p, int w);
}
"@
[Wall]::SystemParametersInfo(20, 0, (Resolve-Path -LiteralPath $env:ALC_PATH).Path, 3) | Out-Null`
      const r = await runPs(script, { path: String(input.path) })
      return r.ok ? ok('🖼️ غيّرت الخلفية') : fail(`تعذّر تغيير الخلفية: ${r.stderr}`)
    },
  },
]
