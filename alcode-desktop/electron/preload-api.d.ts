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
  daily: {
    day(): Promise<any>
    weather(force?: boolean): Promise<any>
    news(force?: boolean): Promise<any[]>
    sources(): Promise<any[]>
    toggleSource(id: string, enabled: boolean): Promise<boolean>
    addSource(url: string, category: string): Promise<{ ok: boolean; name: string; count: number; error: string }>
    removeSource(id: string): Promise<boolean>
    addTopic(query: string): Promise<boolean>
    removeTopic(query: string): Promise<boolean>
    methods(): Promise<{ id: string; arabic: string }[]>
    searchPlaces(query: string): Promise<any[]>
    prayerMonth(year: number, month: number): Promise<any[]>
    tasks(): Promise<any[]>
    habits(): Promise<any[]>
    saveTask(task: unknown): Promise<boolean>
    deleteTask(id: string): Promise<boolean>
    saveHabit(habit: unknown): Promise<boolean>
    deleteHabit(id: string): Promise<boolean>
    openExternal(url: string): Promise<boolean>
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
