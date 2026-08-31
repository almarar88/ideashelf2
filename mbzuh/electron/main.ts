/** نقطة انطلاق تطبيق «الدينامو» لسطح المكتب (ويندوز). */
import path from "node:path";
import { BrowserWindow, Menu, app, ipcMain, shell, dialog } from "electron";
import { autoBackup, closeDb, getDb, getSetting, setSetting } from "./db";
import { isEmptyDatabase, seedDemoData } from "./db/seed";
import { registerCatalogIpc } from "./ipc/catalog";
import { registerLogisticsIpc } from "./ipc/logistics";
import { registerAcademicsIpc } from "./ipc/academics";
import { registerWorkspaceIpc } from "./ipc/workspace";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

function send(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "ملف",
      submenu: [
        { label: "بحث سريع", accelerator: "CmdOrCtrl+K", click: () => send("app:command", "search") },
        { type: "separator" },
        { label: "استيراد ملف إكسل", click: () => send("app:navigate", "reports") },
        { label: "إنشاء نسخة احتياطية", click: () => send("app:command", "backup") },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
    {
      label: "الوحدات",
      submenu: [
        { label: "لوحة المؤشرات", click: () => send("app:navigate", "dashboard") },
        { label: "المدربون", click: () => send("app:navigate", "trainers") },
        { label: "الدورات والمستويات", click: () => send("app:navigate", "courses") },
        { label: "الجدول الأسبوعي", click: () => send("app:navigate", "schedule") },
        { label: "القاعات والحجوزات", click: () => send("app:navigate", "rooms") },
        { label: "الشركاء الخارجيون", click: () => send("app:navigate", "partners") },
        { label: "التقارير والإحصائيات", click: () => send("app:navigate", "reports") },
        { label: "محاضر الاجتماعات", click: () => send("app:navigate", "minutes") },
        { label: "الإعدادات", click: () => send("app:navigate", "settings") },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { label: "إعادة تحميل", role: "reload" },
        { label: "تكبير", role: "zoomIn" },
        { label: "تصغير", role: "zoomOut" },
        { label: "الحجم الافتراضي", role: "resetZoom" },
        { type: "separator" },
        { label: "ملء الشاشة", role: "togglefullscreen" },
        { label: "أدوات المطور", role: "toggleDevTools" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "عن البرنامج",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "عن الدينامو",
              message: "الدينامو — نظام الإدارة الأكاديمية الشامل",
              detail:
                `الإصدار ${app.getVersion()}\n` +
                "قاعدة بيانات محلية تعمل بالكامل على جهازك دون الحاجة للإنترنت.\n" +
                "الوحدات: دورات اللغات والمدربون · لوجستيات التدريب والشركاء · " +
                "التقارير والإحصائيات الأكاديمية · أرشيف المحاضر وتصميم المناهج.",
              buttons: ["حسنًا"],
            });
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: "الدينامو — نظام الإدارة الأكاديمية",
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // منع الانتقال لأي وجهة خارجية داخل النافذة، وفتح الروابط في المتصفح.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (!(devUrl && url.startsWith(devUrl))) event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    app.setAppUserModelId("com.dynamo.academic");

    getDb();
    if (getSetting("seeded") !== "1" && isEmptyDatabase()) {
      seedDemoData();
      setSetting("seeded", "1");
      setSetting("org_name", getSetting("org_name", "الإدارة الأكاديمية"));
    }
    void autoBackup();

    registerCatalogIpc(ipcMain);
    registerLogisticsIpc(ipcMain);
    registerAcademicsIpc(ipcMain);
    registerWorkspaceIpc(ipcMain);

    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // النسخة اليومية تُؤخذ عند بدء التشغيل؛ عند الخروج نغلق القاعدة فقط
  // حتى لا تتسابق عملية النسخ غير المتزامنة مع إغلاق الاتصال.
  app.on("before-quit", () => {
    closeDb();
  });
}
