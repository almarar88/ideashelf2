/** واجهة الجسر كما تراها شيفرة العرض. */
export interface AlcodeBridge {
  settings: {
    get(): Promise<any>
    set(patch: Record<string, unknown>): Promise<any>
    setKey(key: string): Promise<boolean>
    testKey(): Promise<{ ok: boolean; error: string }>
  }
  tools: {
    list(): Promise<{ group: string; tools: { name: string; description: string; danger: string }[] }[]>
    count(): Promise<number>
  }
  platform(): Promise<{ windows: boolean; version: string; platform: string }>
  data: {
    get(key: string): Promise<any>
    deleteMemory(id: string): Promise<boolean>
    deleteNote(id: string): Promise<boolean>
    deleteReminder(id: string): Promise<boolean>
    resetUsage(): Promise<boolean>
  }
  agent: {
    send(payload: { history: unknown[]; fromQuick?: boolean }): Promise<{ ok: boolean; error: string; history?: any[] }>
    stop(): void
    confirm(id: string, allowed: boolean): void
    onEvent(handler: (event: any) => void): () => void
    onConfirm(handler: (request: any) => void): () => void
  }
  quick: {
    hide(): void
    expand(): void
    onFocus(handler: () => void): () => void
  }
}

declare global {
  interface Window {
    alcode: AlcodeBridge
  }
}

export {}
