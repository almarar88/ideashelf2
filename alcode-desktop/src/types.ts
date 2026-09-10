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
}
