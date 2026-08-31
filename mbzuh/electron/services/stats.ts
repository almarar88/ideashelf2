/** لوحة المؤشرات والبحث الفوري الشامل عبر كل وحدات النظام. */
import { getDb } from "../db";
import { detectAllConflicts } from "./conflicts";
import { LANGUAGE_LABELS, LEVEL_LABELS, COURSE_STATUS_LABELS } from "../../shared/labels";
import { normalizeArabic, todayISO } from "../../shared/text";
import type { DashboardStats, Language, Level, SearchHit } from "../../shared/types";

function count(sql: string, params: unknown[] = []): number {
  const row = getDb().prepare(sql).get(...params) as { n: number } | undefined;
  return row?.n ?? 0;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dashboardStats(): DashboardStats {
  const db = getDb();
  const today = todayISO();
  const weekAhead = addDays(today, 7);

  const byLanguage = (
    db
      .prepare(
        `SELECT language AS key, COUNT(*) AS count FROM courses
          WHERE status IN ('planned','active') GROUP BY language ORDER BY count DESC`,
      )
      .all() as { key: string; count: number }[]
  ).map((r) => ({ ...r, label: LANGUAGE_LABELS[r.key as Language] ?? r.key }));

  const byLevel = (
    db
      .prepare(
        `SELECT c.level AS key, COUNT(e.id) AS count
           FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id AND e.status <> 'withdrawn'
          GROUP BY c.level ORDER BY count DESC`,
      )
      .all() as { key: string; count: number }[]
  ).map((r) => ({ ...r, label: LEVEL_LABELS[r.key as Level] ?? r.key }));

  const byStatus = (
    db.prepare("SELECT status AS key, COUNT(*) AS count FROM courses GROUP BY status").all() as {
      key: string;
      count: number;
    }[]
  ).map((r) => ({
    ...r,
    label: COURSE_STATUS_LABELS[r.key as keyof typeof COURSE_STATUS_LABELS] ?? r.key,
  }));

  const roomUtilisation = (
    db
      .prepare(
        `SELECT r.name AS room, COALESCE(SUM(s.end_min - s.start_min), 0) AS minutes
           FROM rooms r
           LEFT JOIN courses c ON c.room_id = r.id AND c.status IN ('planned','active')
           LEFT JOIN course_sessions s ON s.course_id = c.id
          GROUP BY r.id ORDER BY minutes DESC LIMIT 8`,
      )
      .all() as { room: string; minutes: number }[]
  ).map((r) => ({ room: r.room, hours: Math.round((r.minutes / 60) * 10) / 10 }));

  const attendance = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS ok,
         SUM(CASE WHEN status <> 'excused' THEN 1 ELSE 0 END) AS total
       FROM attendance`,
    )
    .get() as { ok: number | null; total: number | null };

  const upcomingCourses = db
    .prepare(
      `SELECT id, title, start_date AS date FROM courses
        WHERE start_date BETWEEN ? AND ? ORDER BY start_date LIMIT 5`,
    )
    .all(today, weekAhead) as { id: number; title: string; date: string }[];

  const upcomingBookings = db
    .prepare(
      `SELECT id, title, date FROM bookings
        WHERE date BETWEEN ? AND ? AND status <> 'cancelled' ORDER BY date LIMIT 5`,
    )
    .all(today, weekAhead) as { id: number; title: string; date: string }[];

  const upcoming = [
    ...upcomingCourses.map((c) => ({ ...c, kind: "بداية دورة" })),
    ...upcomingBookings.map((b) => ({ ...b, kind: "حجز قاعة" })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    trainers: count("SELECT COUNT(*) AS n FROM trainers"),
    activeTrainers: count("SELECT COUNT(*) AS n FROM trainers WHERE status = 'active'"),
    courses: count("SELECT COUNT(*) AS n FROM courses"),
    activeCourses: count("SELECT COUNT(*) AS n FROM courses WHERE status = 'active'"),
    plannedCourses: count("SELECT COUNT(*) AS n FROM courses WHERE status = 'planned'"),
    students: count("SELECT COUNT(*) AS n FROM students"),
    enrollments: count("SELECT COUNT(*) AS n FROM enrollments WHERE status <> 'withdrawn'"),
    rooms: count("SELECT COUNT(*) AS n FROM rooms"),
    partners: count("SELECT COUNT(*) AS n FROM partners"),
    minutes: count("SELECT COUNT(*) AS n FROM minutes"),
    bookingsThisWeek: count(
      "SELECT COUNT(*) AS n FROM bookings WHERE date BETWEEN ? AND ? AND status <> 'cancelled'",
      [today, weekAhead],
    ),
    conflicts: detectAllConflicts().filter((c) => c.severity === "error").length,
    attendanceRate: attendance.total ? (attendance.ok ?? 0) / attendance.total : null,
    byLanguage,
    byLevel,
    byStatus,
    roomUtilisation,
    upcoming,
  };
}

/** بحث فوري موحّد: يطبّع النص العربي ثم يبحث في كل الكيانات. */
export function globalSearch(query: string, limit = 40): SearchHit[] {
  const q = normalizeArabic(query);
  if (q.length < 1) return [];
  const db = getDb();
  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  const trainers = db
    .prepare(
      "SELECT id, name, languages, curricula FROM trainers WHERE search LIKE ? ORDER BY name LIMIT ?",
    )
    .all(like, limit) as { id: number; name: string; languages: string; curricula: string | null }[];
  for (const t of trainers) {
    const langs = (JSON.parse(t.languages || "[]") as Language[])
      .map((l) => LANGUAGE_LABELS[l] ?? l)
      .join("، ");
    hits.push({
      entity: "trainer",
      id: t.id,
      title: t.name,
      subtitle: langs || "مدرب",
      snippet: t.curricula ?? undefined,
    });
  }

  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.language, c.level, c.start_date, t.name AS trainer_name
         FROM courses c LEFT JOIN trainers t ON t.id = c.trainer_id
        WHERE c.search LIKE ? ORDER BY c.start_date DESC LIMIT ?`,
    )
    .all(like, limit) as {
    id: number;
    code: string;
    title: string;
    language: Language;
    level: Level;
    start_date: string;
    trainer_name: string | null;
  }[];
  for (const c of courses) {
    hits.push({
      entity: "course",
      id: c.id,
      title: `${c.code} — ${c.title}`,
      subtitle: `${LANGUAGE_LABELS[c.language] ?? c.language} · ${LEVEL_LABELS[c.level] ?? c.level} · ${c.trainer_name ?? "غير مسند"}`,
      date: c.start_date,
    });
  }

  const minutes = db
    .prepare(
      `SELECT id, title, meeting_date, parties, decisions, curriculum_notes
         FROM minutes WHERE search LIKE ? ORDER BY meeting_date DESC LIMIT ?`,
    )
    .all(like, limit) as {
    id: number;
    title: string;
    meeting_date: string;
    parties: string | null;
    decisions: string | null;
    curriculum_notes: string | null;
  }[];
  for (const m of minutes) {
    hits.push({
      entity: "minute",
      id: m.id,
      title: m.title,
      subtitle: m.parties ?? "محضر اجتماع",
      snippet: (m.decisions || m.curriculum_notes || "").slice(0, 160),
      date: m.meeting_date,
    });
  }

  const partners = db
    .prepare("SELECT id, name, type, contact_person FROM partners WHERE search LIKE ? LIMIT ?")
    .all(like, limit) as { id: number; name: string; type: string | null; contact_person: string | null }[];
  for (const p of partners) {
    hits.push({
      entity: "partner",
      id: p.id,
      title: p.name,
      subtitle: [p.type, p.contact_person].filter(Boolean).join(" · ") || "جهة شريكة",
    });
  }

  const students = db
    .prepare("SELECT id, name, code FROM students WHERE search LIKE ? LIMIT ?")
    .all(like, Math.min(limit, 15)) as { id: number; name: string; code: string | null }[];
  for (const s of students) {
    hits.push({ entity: "student", id: s.id, title: s.name, subtitle: s.code ?? "طالب" });
  }

  const rooms = db.prepare("SELECT id, name, building FROM rooms").all() as {
    id: number;
    name: string;
    building: string | null;
  }[];
  for (const r of rooms) {
    if (normalizeArabic(`${r.name} ${r.building ?? ""}`).includes(q)) {
      hits.push({ entity: "room", id: r.id, title: r.name, subtitle: r.building ?? "قاعة" });
    }
  }

  return hits.slice(0, limit);
}

/** كل المحاضر والمراسلات المرتبطة بمدرب معيّن (بحث بالاسم أو بالربط المباشر). */
export function minutesForTrainer(trainerId: number) {
  const db = getDb();
  const trainer = db.prepare("SELECT name FROM trainers WHERE id = ?").get(trainerId) as
    | { name: string }
    | undefined;
  const nameKey = `%${normalizeArabic(trainer?.name ?? "")}%`;
  return db
    .prepare(
      `SELECT DISTINCT m.* FROM minutes m
         LEFT JOIN minute_trainers mt ON mt.minute_id = m.id
        WHERE mt.trainer_id = ? OR m.search LIKE ?
        ORDER BY m.meeting_date DESC`,
    )
    .all(trainerId, nameKey);
}
