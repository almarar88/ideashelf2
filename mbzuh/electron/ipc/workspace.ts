/** الوحدة الرابعة + خدمات النظام: المحاضر، البحث الفوري، الإعدادات، النسخ الاحتياطي. */
import path from "node:path";
import fs from "node:fs";
import type { IpcMain } from "electron";
import { app, dialog } from "electron";
import {
  backupTo,
  backupsDir,
  closeDb,
  dbPath,
  getDb,
  getSetting,
  logActivity,
  pruneBackups,
  setSetting,
} from "../db";
import { buildSearchIndex } from "../../shared/text";
import { dashboardStats, globalSearch, minutesForTrainer } from "../services/stats";
import { storeFile } from "./logistics";
import { isEmptyDatabase, seedDemoData } from "../db/seed";
import type { MeetingMinute } from "../../shared/types";

function hydrateMinute(row: MeetingMinute): MeetingMinute {
  const db = getDb();
  const trainers = db
    .prepare(
      `SELECT t.id, t.name FROM minute_trainers mt JOIN trainers t ON t.id = mt.trainer_id
        WHERE mt.minute_id = ?`,
    )
    .all(row.id) as { id: number; name: string }[];
  return {
    ...row,
    trainer_ids: trainers.map((t) => t.id),
    trainer_names: trainers.map((t) => t.name),
    files: db
      .prepare("SELECT * FROM minute_files WHERE minute_id = ? ORDER BY created_at")
      .all(row.id) as MeetingMinute["files"],
  };
}

export function registerWorkspaceIpc(ipcMain: IpcMain): void {
  /* ---------------------------- المحاضر ---------------------------- */

  ipcMain.handle(
    "minutes:list",
    (_e, filters: { query?: string; trainerId?: number; from?: string; to?: string } = {}) => {
      const db = getDb();
      const clauses: string[] = ["1=1"];
      const params: Record<string, unknown> = {};
      if (filters.query) {
        clauses.push("m.search LIKE @q");
        params.q = `%${buildSearchIndex(filters.query)}%`;
      }
      if (filters.from) {
        clauses.push("m.meeting_date >= @from");
        params.from = filters.from;
      }
      if (filters.to) {
        clauses.push("m.meeting_date <= @to");
        params.to = filters.to;
      }
      if (filters.trainerId) {
        clauses.push("EXISTS (SELECT 1 FROM minute_trainers mt WHERE mt.minute_id = m.id AND mt.trainer_id = @trainerId)");
        params.trainerId = filters.trainerId;
      }
      const rows = db
        .prepare(`SELECT m.* FROM minutes m WHERE ${clauses.join(" AND ")} ORDER BY m.meeting_date DESC`)
        .all(params) as MeetingMinute[];
      return rows.map(hydrateMinute);
    },
  );

  ipcMain.handle("minutes:get", (_e, id: number) => {
    const row = getDb().prepare("SELECT * FROM minutes WHERE id = ?").get(id) as MeetingMinute | undefined;
    return row ? hydrateMinute(row) : null;
  });

  ipcMain.handle("minutes:byTrainer", (_e, trainerId: number) => minutesForTrainer(trainerId));

  ipcMain.handle("minutes:save", (_e, payload: Partial<MeetingMinute> & { trainer_ids?: number[] }) => {
    const db = getDb();
    const trainerNames = (payload.trainer_ids ?? [])
      .map(
        (id) => (db.prepare("SELECT name FROM trainers WHERE id = ?").get(id) as { name: string } | undefined)?.name,
      )
      .filter(Boolean)
      .join(" ");
    const search = buildSearchIndex(
      payload.title,
      payload.parties,
      payload.attendees,
      payload.agenda,
      payload.decisions,
      payload.curriculum_notes,
      payload.follow_up,
      payload.tags,
      payload.location,
      trainerNames,
    );
    const data = {
      meeting_date: payload.meeting_date,
      title: payload.title,
      location: payload.location ?? null,
      parties: payload.parties ?? null,
      attendees: payload.attendees ?? null,
      agenda: payload.agenda ?? null,
      decisions: payload.decisions ?? null,
      curriculum_notes: payload.curriculum_notes ?? null,
      follow_up: payload.follow_up ?? null,
      tags: payload.tags ?? null,
      search,
    };
    const tx = db.transaction(() => {
      let id = payload.id ?? 0;
      if (id) {
        db.prepare(
          `UPDATE minutes SET meeting_date=@meeting_date, title=@title, location=@location, parties=@parties,
                  attendees=@attendees, agenda=@agenda, decisions=@decisions, curriculum_notes=@curriculum_notes,
                  follow_up=@follow_up, tags=@tags, search=@search, updated_at=datetime('now') WHERE id=@id`,
        ).run({ ...data, id });
      } else {
        id = Number(
          db.prepare(
            `INSERT INTO minutes(meeting_date, title, location, parties, attendees, agenda, decisions,
                                 curriculum_notes, follow_up, tags, search)
             VALUES(@meeting_date,@title,@location,@parties,@attendees,@agenda,@decisions,
                    @curriculum_notes,@follow_up,@tags,@search)`,
          ).run(data).lastInsertRowid,
        );
      }
      db.prepare("DELETE FROM minute_trainers WHERE minute_id = ?").run(id);
      const link = db.prepare("INSERT OR IGNORE INTO minute_trainers(minute_id, trainer_id) VALUES(?,?)");
      for (const tid of payload.trainer_ids ?? []) link.run(id, tid);
      logActivity("minute", id, payload.id ? "تعديل محضر" : "إضافة محضر", payload.title ?? "");
      return id;
    });
    const id = tx();
    return hydrateMinute(db.prepare("SELECT * FROM minutes WHERE id = ?").get(id) as MeetingMinute);
  });

  ipcMain.handle("minutes:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM minutes WHERE id = ?").run(id);
    return true;
  });

  ipcMain.handle("minutes:attach", (_e, minuteId: number, sourcePath: string, title?: string) => {
    const stored = storeFile(sourcePath, "minutes");
    const id = Number(
      getDb()
        .prepare("INSERT INTO minute_files(minute_id, title, file_path, file_name) VALUES(?,?,?,?)")
        .run(minuteId, title || stored.file_name, stored.file_path, stored.file_name).lastInsertRowid,
    );
    return getDb().prepare("SELECT * FROM minute_files WHERE id = ?").get(id);
  });

  ipcMain.handle("minutes:detach", (_e, fileId: number) => {
    const db = getDb();
    const row = db.prepare("SELECT file_path FROM minute_files WHERE id = ?").get(fileId) as
      | { file_path: string }
      | undefined;
    if (row?.file_path) fs.rmSync(row.file_path, { force: true });
    db.prepare("DELETE FROM minute_files WHERE id = ?").run(fileId);
    return true;
  });

  /* ------------------- لوحة المؤشرات والبحث ------------------- */

  ipcMain.handle("dashboard:stats", () => dashboardStats());
  ipcMain.handle("search:global", (_e, query: string) => globalSearch(query));
  ipcMain.handle("activity:recent", () =>
    getDb().prepare("SELECT * FROM activity_log ORDER BY id DESC LIMIT 40").all(),
  );

  /* --------------------------- الإعدادات --------------------------- */

  ipcMain.handle("settings:all", () => {
    const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  ipcMain.handle("settings:set", (_e, key: string, value: string) => {
    setSetting(key, value);
    return true;
  });

  ipcMain.handle("system:info", () => ({
    version: app.getVersion(),
    dbPath: dbPath(),
    dataDir: app.getPath("userData"),
    backupsDir: backupsDir(),
    orgName: getSetting("org_name", "الإدارة الأكاديمية"),
    electron: process.versions.electron,
    dbSize: fs.existsSync(dbPath()) ? fs.statSync(dbPath()).size : 0,
  }));

  /* ---------------------- النسخ الاحتياطي ---------------------- */

  ipcMain.handle("backup:list", () => {
    const dir = backupsDir();
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return { path: path.join(dir, f), size: stat.size, created_at: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

  ipcMain.handle("backup:create", async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const target = path.join(backupsDir(), `dynamo-${stamp}.db`);
    const info = await backupTo(target);
    pruneBackups(20);
    logActivity("backup", null, "إنشاء نسخة احتياطية", path.basename(target));
    return info;
  });

  ipcMain.handle("backup:export", async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath("documents"), `dynamo-backup-${stamp}.db`),
      filters: [{ name: "قاعدة بيانات الدينامو", extensions: ["db"] }],
    });
    if (res.canceled || !res.filePath) return null;
    return backupTo(res.filePath);
  });

  ipcMain.handle("backup:restore", async (_e, sourcePath?: string) => {
    let source = sourcePath;
    if (!source) {
      const res = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "قاعدة بيانات الدينامو", extensions: ["db"] }],
      });
      if (res.canceled) return { ok: false, message: "أُلغيت العملية." };
      source = res.filePaths[0];
    }
    const confirm = await dialog.showMessageBox({
      type: "warning",
      buttons: ["استعادة وإعادة التشغيل", "إلغاء"],
      defaultId: 1,
      cancelId: 1,
      title: "استعادة نسخة احتياطية",
      message: "سيتم استبدال البيانات الحالية بالكامل بمحتوى النسخة المختارة.",
      detail: "يُنصح بإنشاء نسخة احتياطية من الوضع الحالي قبل المتابعة.",
    });
    if (confirm.response !== 0) return { ok: false, message: "أُلغيت العملية." };

    const safety = path.join(backupsDir(), `before-restore-${Date.now()}.db`);
    await backupTo(safety);
    closeDb();
    fs.copyFileSync(source, dbPath());
    for (const suffix of ["-wal", "-shm"]) fs.rmSync(`${dbPath()}${suffix}`, { force: true });
    app.relaunch();
    app.exit(0);
    return { ok: true, message: "تمت الاستعادة." };
  });

  /* ------------------- البيانات التجريبية ------------------- */

  ipcMain.handle("demo:seed", () => {
    if (!isEmptyDatabase()) return { ok: false, message: "قاعدة البيانات تحتوي على بيانات بالفعل." };
    seedDemoData();
    return { ok: true, message: "تمت إضافة البيانات التجريبية." };
  });

  ipcMain.handle("demo:reset", async () => {
    const confirm = await dialog.showMessageBox({
      type: "warning",
      buttons: ["حذف كل البيانات", "إلغاء"],
      defaultId: 1,
      cancelId: 1,
      title: "تفريغ قاعدة البيانات",
      message: "سيتم حذف كل السجلات (المدربون، الدورات، الطلبة، المحاضر...) نهائيًا.",
    });
    if (confirm.response !== 0) return { ok: false, message: "أُلغيت العملية." };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await backupTo(path.join(backupsDir(), `before-reset-${stamp}.db`));
    const db = getDb();
    db.transaction(() => {
      for (const table of [
        "attendance", "enrollments", "students", "course_sessions", "courses",
        "trainer_availability", "trainers", "minute_files", "minute_trainers", "minutes",
        "partner_docs", "partners", "bookings", "rooms", "import_logs", "activity_log",
      ]) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
    })();
    return { ok: true, message: "تم تفريغ قاعدة البيانات (مع حفظ نسخة احتياطية)." };
  });
}
