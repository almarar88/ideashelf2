import { contextBridge, ipcRenderer } from "electron";

/** بادئات القنوات المسموح باستدعائها من الواجهة (حماية إضافية). */
const ALLOWED_PREFIXES = [
  "trainers:", "rooms:", "courses:", "conflicts:", "schedule:",
  "partners:", "partnerDocs:", "bookings:", "files:",
  "students:", "enrollments:", "attendance:", "import:", "reports:",
  "minutes:", "dashboard:", "search:", "activity:", "settings:", "system:",
  "backup:", "demo:",
];

function assertAllowed(channel: string): void {
  if (!ALLOWED_PREFIXES.some((p) => channel.startsWith(p))) {
    throw new Error(`قناة غير مسموح بها: ${channel}`);
  }
}

contextBridge.exposeInMainWorld("dynamo", {
  invoke: (channel: string, ...args: unknown[]) => {
    assertAllowed(channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!channel.startsWith("app:")) throw new Error(`قناة غير مسموح بها: ${channel}`);
    const wrapped = (_e: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
