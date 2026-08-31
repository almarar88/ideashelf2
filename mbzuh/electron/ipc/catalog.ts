/** الوحدة الأولى: المدربون، القاعات، الدورات، وكاشف التعارض. */
import type { IpcMain } from "electron";
import { getDb, logActivity } from "../db";
import { buildSearchIndex } from "../../shared/text";
import { LANGUAGE_LABELS, LEVEL_LABELS } from "../../shared/labels";
import {
  checkBookingCandidate,
  checkCourseCandidate,
  detectAllConflicts,
} from "../services/conflicts";
import type { Availability, Course, CourseSession, Room, Trainer } from "../../shared/types";

interface TrainerRow extends Omit<Trainer, "languages" | "availability"> {
  languages: string;
}

function hydrateTrainer(row: TrainerRow): Trainer {
  const db = getDb();
  return {
    ...row,
    languages: JSON.parse(row.languages || "[]"),
    availability: db
      .prepare("SELECT * FROM trainer_availability WHERE trainer_id = ? ORDER BY weekday, start_min")
      .all(row.id) as Availability[],
  };
}

export function registerCatalogIpc(ipcMain: IpcMain): void {
  /* ---------------------------- المدربون ---------------------------- */

  ipcMain.handle("trainers:list", (_e, query?: string) => {
    const db = getDb();
    const rows = (
      query
        ? db.prepare(
            `SELECT t.*, (SELECT COUNT(*) FROM courses c WHERE c.trainer_id = t.id) AS course_count
               FROM trainers t WHERE t.search LIKE ? ORDER BY t.name`,
          ).all(`%${buildSearchIndex(query)}%`)
        : db.prepare(
            `SELECT t.*, (SELECT COUNT(*) FROM courses c WHERE c.trainer_id = t.id) AS course_count
               FROM trainers t ORDER BY t.name`,
          ).all()
    ) as TrainerRow[];
    return rows.map(hydrateTrainer);
  });

  ipcMain.handle("trainers:get", (_e, id: number) => {
    const row = getDb().prepare("SELECT * FROM trainers WHERE id = ?").get(id) as TrainerRow | undefined;
    return row ? hydrateTrainer(row) : null;
  });

  ipcMain.handle("trainers:save", (_e, payload: Partial<Trainer> & { availability?: Availability[] }) => {
    const db = getDb();
    const languages = JSON.stringify(payload.languages ?? []);
    const search = buildSearchIndex(
      payload.name,
      payload.phone,
      payload.email,
      payload.employment_type,
      payload.curricula,
      payload.notes,
      (payload.languages ?? []).map((l) => LANGUAGE_LABELS[l] ?? l).join(" "),
    );
    const tx = db.transaction(() => {
      let id = payload.id ?? 0;
      if (id) {
        db.prepare(
          `UPDATE trainers SET name=@name, phone=@phone, email=@email, employment_type=@employment_type,
                  languages=@languages, curricula=@curricula, notes=@notes, status=@status,
                  search=@search, updated_at=datetime('now') WHERE id=@id`,
        ).run({
          id,
          name: payload.name,
          phone: payload.phone ?? null,
          email: payload.email ?? null,
          employment_type: payload.employment_type ?? null,
          languages,
          curricula: payload.curricula ?? null,
          notes: payload.notes ?? null,
          status: payload.status ?? "active",
          search,
        });
      } else {
        id = Number(
          db.prepare(
            `INSERT INTO trainers(name, phone, email, employment_type, languages, curricula, notes, status, search)
             VALUES(@name, @phone, @email, @employment_type, @languages, @curricula, @notes, @status, @search)`,
          ).run({
            name: payload.name,
            phone: payload.phone ?? null,
            email: payload.email ?? null,
            employment_type: payload.employment_type ?? null,
            languages,
            curricula: payload.curricula ?? null,
            notes: payload.notes ?? null,
            status: payload.status ?? "active",
            search,
          }).lastInsertRowid,
        );
      }
      db.prepare("DELETE FROM trainer_availability WHERE trainer_id = ?").run(id);
      const ins = db.prepare(
        "INSERT INTO trainer_availability(trainer_id, weekday, start_min, end_min, note) VALUES(?,?,?,?,?)",
      );
      for (const slot of payload.availability ?? []) {
        if (slot.end_min > slot.start_min) {
          ins.run(id, slot.weekday, slot.start_min, slot.end_min, slot.note ?? null);
        }
      }
      logActivity("trainer", id, payload.id ? "تعديل مدرب" : "إضافة مدرب", payload.name ?? "");
      return id;
    });
    const id = tx();
    const row = db.prepare("SELECT * FROM trainers WHERE id = ?").get(id) as TrainerRow;
    return hydrateTrainer(row);
  });

  ipcMain.handle("trainers:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM trainers WHERE id = ?").run(id);
    logActivity("trainer", id, "حذف مدرب");
    return true;
  });

  /* ----------------------------- القاعات ----------------------------- */

  ipcMain.handle("rooms:list", () =>
    getDb()
      .prepare(
        `SELECT r.*, (SELECT COUNT(*) FROM courses c WHERE c.room_id = r.id AND c.status IN ('planned','active')) AS course_count
           FROM rooms r ORDER BY r.building, r.name`,
      )
      .all(),
  );

  ipcMain.handle("rooms:save", (_e, payload: Partial<Room>) => {
    const db = getDb();
    if (payload.id) {
      db.prepare(
        `UPDATE rooms SET name=@name, building=@building, capacity=@capacity, features=@features,
                status=@status, notes=@notes WHERE id=@id`,
      ).run({
        id: payload.id,
        name: payload.name,
        building: payload.building ?? null,
        capacity: payload.capacity ?? 0,
        features: payload.features ?? null,
        status: payload.status ?? "available",
        notes: payload.notes ?? null,
      });
      logActivity("room", payload.id, "تعديل قاعة", payload.name ?? "");
      return db.prepare("SELECT * FROM rooms WHERE id = ?").get(payload.id);
    }
    const id = Number(
      db.prepare(
        "INSERT INTO rooms(name, building, capacity, features, status, notes) VALUES(@name,@building,@capacity,@features,@status,@notes)",
      ).run({
        name: payload.name,
        building: payload.building ?? null,
        capacity: payload.capacity ?? 0,
        features: payload.features ?? null,
        status: payload.status ?? "available",
        notes: payload.notes ?? null,
      }).lastInsertRowid,
    );
    logActivity("room", id, "إضافة قاعة", payload.name ?? "");
    return db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  });

  ipcMain.handle("rooms:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM rooms WHERE id = ?").run(id);
    logActivity("room", id, "حذف قاعة");
    return true;
  });

  /* ----------------------------- الدورات ----------------------------- */

  const courseSelect = `SELECT c.*, t.name AS trainer_name, r.name AS room_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'withdrawn') AS enrolled_count
      FROM courses c LEFT JOIN trainers t ON t.id = c.trainer_id LEFT JOIN rooms r ON r.id = c.room_id`;

  const withSessions = (rows: Course[]): Course[] => {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM course_sessions WHERE course_id = ? ORDER BY weekday, start_min");
    return rows.map((c) => ({ ...c, sessions: stmt.all(c.id) as CourseSession[] }));
  };

  ipcMain.handle("courses:list", (_e, filters: { query?: string; status?: string; language?: string } = {}) => {
    const db = getDb();
    const clauses: string[] = ["1=1"];
    const params: Record<string, unknown> = {};
    if (filters.query) {
      clauses.push("c.search LIKE @q");
      params.q = `%${buildSearchIndex(filters.query)}%`;
    }
    if (filters.status && filters.status !== "all") {
      clauses.push("c.status = @status");
      params.status = filters.status;
    }
    if (filters.language && filters.language !== "all") {
      clauses.push("c.language = @language");
      params.language = filters.language;
    }
    const rows = db
      .prepare(`${courseSelect} WHERE ${clauses.join(" AND ")} ORDER BY c.start_date DESC, c.code`)
      .all(params) as Course[];
    return withSessions(rows);
  });

  ipcMain.handle("courses:get", (_e, id: number) => {
    const row = getDb().prepare(`${courseSelect} WHERE c.id = ?`).get(id) as Course | undefined;
    return row ? withSessions([row])[0] : null;
  });

  ipcMain.handle("courses:save", (_e, payload: Partial<Course> & { sessions?: CourseSession[] }) => {
    const db = getDb();
    const search = buildSearchIndex(
      payload.code,
      payload.title,
      LANGUAGE_LABELS[payload.language ?? "english"],
      LEVEL_LABELS[payload.level ?? "level1"],
      payload.curriculum,
      payload.notes,
    );
    const tx = db.transaction(() => {
      const data = {
        code: payload.code,
        title: payload.title,
        language: payload.language,
        level: payload.level,
        trainer_id: payload.trainer_id ?? null,
        room_id: payload.room_id ?? null,
        start_date: payload.start_date,
        end_date: payload.end_date,
        capacity: payload.capacity ?? 0,
        status: payload.status ?? "planned",
        curriculum: payload.curriculum ?? null,
        notes: payload.notes ?? null,
        search,
      };
      let id = payload.id ?? 0;
      if (id) {
        db.prepare(
          `UPDATE courses SET code=@code, title=@title, language=@language, level=@level,
                  trainer_id=@trainer_id, room_id=@room_id, start_date=@start_date, end_date=@end_date,
                  capacity=@capacity, status=@status, curriculum=@curriculum, notes=@notes,
                  search=@search, updated_at=datetime('now') WHERE id=@id`,
        ).run({ ...data, id });
      } else {
        id = Number(
          db.prepare(
            `INSERT INTO courses(code, title, language, level, trainer_id, room_id, start_date, end_date,
                                 capacity, status, curriculum, notes, search)
             VALUES(@code,@title,@language,@level,@trainer_id,@room_id,@start_date,@end_date,
                    @capacity,@status,@curriculum,@notes,@search)`,
          ).run(data).lastInsertRowid,
        );
      }
      db.prepare("DELETE FROM course_sessions WHERE course_id = ?").run(id);
      const ins = db.prepare(
        "INSERT INTO course_sessions(course_id, weekday, start_min, end_min) VALUES(?,?,?,?)",
      );
      for (const s of payload.sessions ?? []) {
        if (s.end_min > s.start_min) ins.run(id, s.weekday, s.start_min, s.end_min);
      }
      logActivity("course", id, payload.id ? "تعديل دورة" : "إضافة دورة", `${payload.code} — ${payload.title}`);
      return id;
    });
    const id = tx();
    const row = db.prepare(`${courseSelect} WHERE c.id = ?`).get(id) as Course;
    return withSessions([row])[0];
  });

  ipcMain.handle("courses:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM courses WHERE id = ?").run(id);
    logActivity("course", id, "حذف دورة");
    return true;
  });

  /* -------------------------- كاشف التعارض -------------------------- */

  ipcMain.handle("conflicts:all", () => detectAllConflicts());
  ipcMain.handle("conflicts:course", (_e, candidate) => checkCourseCandidate(candidate));
  ipcMain.handle("conflicts:booking", (_e, candidate) => checkBookingCandidate(candidate));

  /** الجدول الأسبوعي الموحّد (دورات + حجوزات) لعرضه في شاشة الجدول. */
  ipcMain.handle("schedule:week", () => {
    const db = getDb();
    const sessions = db
      .prepare(
        `SELECT s.id, s.weekday, s.start_min, s.end_min, c.id AS course_id, c.code, c.title,
                c.status, c.language, c.start_date, c.end_date,
                t.name AS trainer_name, r.name AS room_name
           FROM course_sessions s
           JOIN courses c ON c.id = s.course_id
           LEFT JOIN trainers t ON t.id = c.trainer_id
           LEFT JOIN rooms r ON r.id = c.room_id
          WHERE c.status IN ('planned','active')
          ORDER BY s.weekday, s.start_min`,
      )
      .all();
    return { sessions, conflicts: detectAllConflicts() };
  });
}
