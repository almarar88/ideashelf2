/**
 * طبقة قاعدة البيانات المحلية.
 *
 * تعتمد على وحدة `node:sqlite` المدمجة في Electron بدلًا من وحدة أصلية
 * تحتاج إلى ترجمة (native module)، ما يعني أن التطبيق يُبنى ويُشغَّل على
 * ويندوز دون الحاجة لتثبيت أدوات ترجمة C++ على جهاز المستخدم.
 */
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";
import { app } from "electron";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Stmt {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  run(...params: any[]): RunResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** غلاف رفيع يوحّد الواجهة ويضيف المعاملات (transactions) والنسخ الاحتياطي. */
export class Db {
  constructor(private readonly raw: DatabaseSync) {}

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare(sql: string): Stmt {
    const stmt = this.raw.prepare(sql);
    return {
      run: (...params) => {
        const res = stmt.run(...params);
        return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  }

  /** ينفّذ الدالة داخل معاملة واحدة، ويتراجع عنها بالكامل عند أي خطأ. */
  transaction<T>(fn: () => T): () => T {
    return () => {
      this.raw.exec("BEGIN");
      try {
        const result = fn();
        this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          this.raw.exec("ROLLBACK");
        } catch {
          /* المعاملة أُغلقت مسبقًا */
        }
        throw error;
      }
    };
  }

  async backup(target: string): Promise<void> {
    await sqliteBackup(this.raw, target);
  }

  close(): void {
    this.raw.close();
  }
}

let db: Db | null = null;

export function dataDir(): string {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function filesDir(): string {
  const dir = path.join(dataDir(), "files");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function backupsDir(): string {
  const dir = path.join(dataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return path.join(dataDir(), "dynamo.db");
}

export function getDb(): Db {
  if (db) return db;
  const raw = new DatabaseSync(dbPath());
  db = new Db(raw);
  db.exec(SCHEMA_SQL);
  const current = Number(
    (db.prepare("SELECT value FROM settings WHERE key = ?").get("schema_version") as
      | { value: string }
      | undefined)?.value ?? 0,
  );
  if (current < SCHEMA_VERSION) {
    db.prepare(
      "INSERT INTO settings(key, value) VALUES('schema_version', ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
  }
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function logActivity(entity: string, entityId: number | null, action: string, detail = ""): void {
  try {
    getDb()
      .prepare("INSERT INTO activity_log(entity, entity_id, action, detail) VALUES(?, ?, ?, ?)")
      .run(entity, entityId, action, detail);
  } catch {
    /* السجل ثانوي: لا يجب أن يفشل العملية الأساسية */
  }
}

/** نسخة احتياطية آمنة أثناء التشغيل (تستخدم واجهة backup الخاصة بـ SQLite). */
export async function backupTo(target: string): Promise<{ path: string; size: number }> {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await getDb().backup(target);
  return { path: target, size: fs.statSync(target).size };
}

/** نسخة يومية تلقائية (تُنفَّذ مرة واحدة في اليوم). */
export async function autoBackup(): Promise<void> {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const target = path.join(backupsDir(), `dynamo-${stamp}.db`);
    if (fs.existsSync(target)) return;
    await backupTo(target);
    pruneBackups(20);
  } catch {
    /* تجاهل: النسخ الاحتياطي التلقائي لا يعطّل التطبيق */
  }
}

export function pruneBackups(keep: number): void {
  const dir = backupsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const extra of files.slice(keep)) fs.rmSync(path.join(dir, extra.f), { force: true });
}
