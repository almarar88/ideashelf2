/** تصدير التقارير إلى PDF عبر محرك الطباعة المدمج في Electron (دعم كامل للعربية). */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { BrowserWindow } from "electron";

export async function htmlToPdf(html: string, targetPath: string): Promise<string> {
  const tmp = path.join(os.tmpdir(), `dynamo-report-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, "utf8");
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: true, javascript: false },
  });
  try {
    await win.loadFile(tmp);
    const data = await win.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { marginType: "default" },
    });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    return targetPath;
  } finally {
    win.destroy();
    fs.rmSync(tmp, { force: true });
  }
}
