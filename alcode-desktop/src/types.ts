export interface ToolRun {
  name: string
  label: string
  ok: boolean
  denied?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  runs: ToolRun[]
  error?: boolean
}

export interface ConfirmRequest {
  id: string
  tool: string
  danger: 'safe' | 'confirm' | 'high'
  title: string
  details: string
}

export interface Place {
  name: string
  country: string
  admin: string
  latitude: number
  longitude: number
  timezone: string
  elevation: number
}

export interface PrayerConfig {
  methodId: string
  asrFactor: 1 | 2
  highLatitudeRule: 'MIDDLE_OF_NIGHT' | 'SEVENTH_OF_NIGHT' | 'ANGLE_BASED'
  elevationMeters: number
  offsets: Record<string, number>
}

export interface AppSettings {
  model: string
  effort: string
  dialect: string
  webSearch: boolean
  confirmDanger: boolean
  hotkey: string
  launchAtLogin: boolean
  theme: 'light' | 'dark' | 'system'
  userName: string
  persona: string
  hasApiKey: boolean

  // ---- الرفيق اليومي
  place: Place | null
  prayer: PrayerConfig
  hijriOffset: number
  use24h: boolean
  disabledSources: string[]
  customSources: { id: string; name: string; url: string; category: string }[]
  topics: string[]
  newsRefreshMinutes: number
  prayerAlerts: boolean
  onboarded: boolean
  morningBriefAt: string
}
