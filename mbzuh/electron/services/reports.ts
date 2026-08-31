/**
 * مولّد التقارير الأكاديمية: يبني بيانات التقرير من قاعدة البيانات ثم يمرّرها
 * إلزاميًا عبر «فلتر الأرقام» قبل إخراجها بأي صيغة.
 */
import { getDb } from "../db";
import { sanitiseReport } from "./sanitiser";
import { LANGUAGE_LABELS, LEVEL_LABELS, COURSE_STATUS_LABELS } from "../../shared/labels";
import { formatDate, minutesToLabel, WEEKDAY_NAMES } from "../../shared/text";
import type { AcademicReport, Language, Level, ReportOptions, ReportSectionTable } from "../../shared/types";

const ALL_SECTIONS = [
  "registrations",
  "attendance",
  "levels",
  "languages",
  "trainers",
  "rooms",
  "status",
  "schedule",
] as const;

export type SectionId = (typeof ALL_SECTIONS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  registrations: "أعداد المسجلين في الدورات",
  attendance: "نسب الحضور والغياب",
  levels: "توزيع الطلبة على المستويات",
  languages: "الإحصاء حسب اللغة",
  trainers: "إحصائيات المدربين",
  rooms: "إشغال القاعات",
  status: "حالة الدورات",
  schedule: "الجدول الأسبوعي للدورات",
};

interface CourseAgg {
  id: number;
  code: string;
  title: string;
  language: Language;
  level: Level;
  status: string;
  capacity: number;
  start_date: string;
  end_date: string;
  trainer_name: string | null;
  room_name: string | null;
  enrolled: number;
  weekly_minutes: number;
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function courseFilterSql(opts: ReportOptions, params: Record<string, unknown>): string {
  const clauses: string[] = ["1=1"];
  if (opts.from) {
    clauses.push("c.end_date >= @from");
    params.from = opts.from;
  }
  if (opts.to) {
    clauses.push("c.start_date <= @to");
    params.to = opts.to;
  }
  if (opts.language && opts.language !== "all") {
    clauses.push("c.language = @language");
    params.language = opts.language;
  }
  if (opts.level && opts.level !== "all") {
    clauses.push("c.level = @level");
    params.level = opts.level;
  }
  if (opts.trainerId && opts.trainerId !== "all") {
    clauses.push("c.trainer_id = @trainerId");
    params.trainerId = opts.trainerId;
  }
  return clauses.join(" AND ");
}

export function buildAcademicReport(opts: ReportOptions = {}): AcademicReport {
  const db = getDb();
  const params: Record<string, unknown> = {};
  const where = courseFilterSql(opts, params);

  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.language, c.level, c.status, c.capacity,
              c.start_date, c.end_date,
              t.name AS trainer_name, r.name AS room_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'withdrawn') AS enrolled,
              COALESCE((SELECT SUM(s.end_min - s.start_min) FROM course_sessions s WHERE s.course_id = c.id), 0) AS weekly_minutes
         FROM courses c
         LEFT JOIN trainers t ON t.id = c.trainer_id
         LEFT JOIN rooms r ON r.id = c.room_id
        WHERE ${where}
        ORDER BY c.start_date DESC, c.code`,
    )
    .all(params) as CourseAgg[];

  const courseIds = courses.map((c) => c.id);
  const idList = courseIds.length ? courseIds.join(",") : "-1";

  const attendanceParams: Record<string, unknown> = {};
  let attendanceWhere = `e.course_id IN (${idList})`;
  if (opts.from) {
    attendanceWhere += " AND a.date >= @afrom";
    attendanceParams.afrom = opts.from;
  }
  if (opts.to) {
    attendanceWhere += " AND a.date <= @ato";
    attendanceParams.ato = opts.to;
  }

  const attendanceRows = db
    .prepare(
      `SELECT e.course_id AS course_id, a.status AS status, COUNT(*) AS n
         FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE ${attendanceWhere}
        GROUP BY e.course_id, a.status`,
    )
    .all(attendanceParams) as { course_id: number; status: string; n: number }[];

  const attendanceByCourse = new Map<number, Record<string, number>>();
  for (const row of attendanceRows) {
    const entry = attendanceByCourse.get(row.course_id) ?? { present: 0, absent: 0, late: 0, excused: 0 };
    entry[row.status] = (entry[row.status] ?? 0) + row.n;
    attendanceByCourse.set(row.course_id, entry);
  }

  const rate = (a: Record<string, number> | undefined): { value: number | null; label: string } => {
    if (!a) return { value: null, label: "—" };
    const counted = (a.present ?? 0) + (a.late ?? 0) + (a.absent ?? 0);
    if (!counted) return { value: null, label: "—" };
    const v = ((a.present ?? 0) + (a.late ?? 0)) / counted;
    return { value: v, label: `${Math.round(v * 1000) / 10}%` };
  };

  const distinctStudents = db
    .prepare(
      `SELECT COUNT(DISTINCT e.student_id) AS n FROM enrollments e
        WHERE e.course_id IN (${idList}) AND e.status <> 'withdrawn'`,
    )
    .get() as { n: number };

  const totalEnrolled = courses.reduce((s, c) => s + c.enrolled, 0);
  const totalCapacity = courses.reduce((s, c) => s + c.capacity, 0);
  const allAttendance = [...attendanceByCourse.values()].reduce(
    (acc, a) => ({
      present: acc.present + (a.present ?? 0),
      late: acc.late + (a.late ?? 0),
      absent: acc.absent + (a.absent ?? 0),
      excused: acc.excused + (a.excused ?? 0),
    }),
    { present: 0, late: 0, absent: 0, excused: 0 },
  );
  const overall = rate(allAttendance);

  const wanted = new Set<string>(opts.includeSections?.length ? opts.includeSections : [...ALL_SECTIONS]);
  const sections: ReportSectionTable[] = [];

  if (wanted.has("registrations")) {
    sections.push({
      id: "registrations",
      title: SECTION_LABELS.registrations,
      columns: [
        { key: "code", label: "الرمز" },
        { key: "title", label: "الدورة" },
        { key: "language", label: "اللغة" },
        { key: "level", label: "المستوى" },
        { key: "trainer", label: "المدرب" },
        { key: "period", label: "الفترة", align: "center" },
        { key: "capacity", label: "الطاقة", align: "center" },
        { key: "enrolled", label: "المسجلون", align: "center" },
        { key: "fill", label: "نسبة الإشغال", align: "center" },
      ],
      rows: courses.map((c) => ({
        code: c.code,
        title: c.title,
        language: LANGUAGE_LABELS[c.language] ?? c.language,
        level: LEVEL_LABELS[c.level] ?? c.level,
        trainer: c.trainer_name ?? "غير مسند",
        period: `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`,
        capacity: c.capacity,
        enrolled: c.enrolled,
        fill: pct(c.enrolled, c.capacity),
      })),
    });
  }

  if (wanted.has("attendance")) {
    sections.push({
      id: "attendance",
      title: SECTION_LABELS.attendance,
      note: "نسبة الحضور = (حاضر + متأخر) ÷ (حاضر + متأخر + غائب). الغياب بعذر لا يُحتسب ضمن المقام.",
      columns: [
        { key: "code", label: "الرمز" },
        { key: "title", label: "الدورة" },
        { key: "present", label: "حضور", align: "center" },
        { key: "late", label: "تأخر", align: "center" },
        { key: "absent", label: "غياب", align: "center" },
        { key: "excused", label: "بعذر", align: "center" },
        { key: "rate", label: "نسبة الحضور", align: "center" },
      ],
      rows: courses.map((c) => {
        const a = attendanceByCourse.get(c.id);
        return {
          code: c.code,
          title: c.title,
          present: a?.present ?? 0,
          late: a?.late ?? 0,
          absent: a?.absent ?? 0,
          excused: a?.excused ?? 0,
          rate: rate(a).label,
        };
      }),
    });
  }

  if (wanted.has("levels")) {
    const byLevel = new Map<string, { students: number; courses: number }>();
    for (const c of courses) {
      const entry = byLevel.get(c.level) ?? { students: 0, courses: 0 };
      entry.students += c.enrolled;
      entry.courses += 1;
      byLevel.set(c.level, entry);
    }
    sections.push({
      id: "levels",
      title: SECTION_LABELS.levels,
      columns: [
        { key: "level", label: "المستوى" },
        { key: "courses", label: "عدد الدورات", align: "center" },
        { key: "students", label: "عدد الطلبة", align: "center" },
        { key: "share", label: "النسبة", align: "center" },
      ],
      rows: [...byLevel.entries()]
        .sort((a, b) => b[1].students - a[1].students)
        .map(([level, v]) => ({
          level: LEVEL_LABELS[level as Level] ?? level,
          courses: v.courses,
          students: v.students,
          share: pct(v.students, totalEnrolled),
        })),
    });
  }

  if (wanted.has("languages")) {
    const byLang = new Map<string, { students: number; courses: number; trainers: Set<string> }>();
    for (const c of courses) {
      const entry = byLang.get(c.language) ?? { students: 0, courses: 0, trainers: new Set<string>() };
      entry.students += c.enrolled;
      entry.courses += 1;
      if (c.trainer_name) entry.trainers.add(c.trainer_name);
      byLang.set(c.language, entry);
    }
    sections.push({
      id: "languages",
      title: SECTION_LABELS.languages,
      columns: [
        { key: "language", label: "اللغة" },
        { key: "courses", label: "الدورات", align: "center" },
        { key: "students", label: "الطلبة", align: "center" },
        { key: "trainers", label: "المدربون", align: "center" },
        { key: "share", label: "النسبة", align: "center" },
      ],
      rows: [...byLang.entries()]
        .sort((a, b) => b[1].students - a[1].students)
        .map(([lang, v]) => ({
          language: LANGUAGE_LABELS[lang as Language] ?? lang,
          courses: v.courses,
          students: v.students,
          trainers: v.trainers.size,
          share: pct(v.students, totalEnrolled),
        })),
    });
  }

  if (wanted.has("trainers")) {
    const byTrainer = new Map<string, { courses: number; students: number; minutes: number }>();
    for (const c of courses) {
      const key = c.trainer_name ?? "غير مسند";
      const entry = byTrainer.get(key) ?? { courses: 0, students: 0, minutes: 0 };
      entry.courses += 1;
      entry.students += c.enrolled;
      entry.minutes += c.weekly_minutes;
      byTrainer.set(key, entry);
    }
    sections.push({
      id: "trainers",
      title: SECTION_LABELS.trainers,
      columns: [
        { key: "trainer", label: "المدرب" },
        { key: "courses", label: "الدورات", align: "center" },
        { key: "students", label: "الطلبة", align: "center" },
        { key: "hours", label: "ساعات أسبوعية", align: "center" },
      ],
      rows: [...byTrainer.entries()]
        .sort((a, b) => b[1].courses - a[1].courses)
        .map(([trainer, v]) => ({
          trainer,
          courses: v.courses,
          students: v.students,
          hours: Math.round((v.minutes / 60) * 10) / 10,
        })),
    });
  }

  if (wanted.has("rooms")) {
    const byRoom = new Map<string, { courses: number; minutes: number }>();
    for (const c of courses) {
      const key = c.room_name ?? "بدون قاعة";
      const entry = byRoom.get(key) ?? { courses: 0, minutes: 0 };
      entry.courses += 1;
      entry.minutes += c.weekly_minutes;
      byRoom.set(key, entry);
    }
    sections.push({
      id: "rooms",
      title: SECTION_LABELS.rooms,
      columns: [
        { key: "room", label: "القاعة" },
        { key: "courses", label: "الدورات", align: "center" },
        { key: "hours", label: "ساعات أسبوعية", align: "center" },
      ],
      rows: [...byRoom.entries()]
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .map(([room, v]) => ({ room, courses: v.courses, hours: Math.round((v.minutes / 60) * 10) / 10 })),
    });
  }

  if (wanted.has("status")) {
    const byStatus = new Map<string, number>();
    for (const c of courses) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    sections.push({
      id: "status",
      title: SECTION_LABELS.status,
      columns: [
        { key: "status", label: "الحالة" },
        { key: "count", label: "العدد", align: "center" },
        { key: "share", label: "النسبة", align: "center" },
      ],
      rows: [...byStatus.entries()].map(([status, count]) => ({
        status: COURSE_STATUS_LABELS[status as keyof typeof COURSE_STATUS_LABELS] ?? status,
        count,
        share: pct(count, courses.length),
      })),
    });
  }

  if (wanted.has("schedule") && courseIds.length) {
    const rows = db
      .prepare(
        `SELECT c.code, c.title, s.weekday, s.start_min, s.end_min,
                t.name AS trainer_name, r.name AS room_name
           FROM course_sessions s
           JOIN courses c ON c.id = s.course_id
           LEFT JOIN trainers t ON t.id = c.trainer_id
           LEFT JOIN rooms r ON r.id = c.room_id
          WHERE c.id IN (${idList})
          ORDER BY s.weekday, s.start_min`,
      )
      .all() as {
      code: string;
      title: string;
      weekday: number;
      start_min: number;
      end_min: number;
      trainer_name: string | null;
      room_name: string | null;
    }[];
    sections.push({
      id: "schedule",
      title: SECTION_LABELS.schedule,
      columns: [
        { key: "day", label: "اليوم" },
        { key: "time", label: "الوقت", align: "center" },
        { key: "course", label: "الدورة" },
        { key: "trainer", label: "المدرب" },
        { key: "room", label: "القاعة" },
      ],
      rows: rows.map((r) => ({
        day: WEEKDAY_NAMES[r.weekday],
        time: `${minutesToLabel(r.start_min)} – ${minutesToLabel(r.end_min)}`,
        course: `${r.code} — ${r.title}`,
        trainer: r.trainer_name ?? "غير مسند",
        room: r.room_name ?? "—",
      })),
    });
  }

  const filters: Record<string, string> = {
    اللغة: opts.language && opts.language !== "all" ? LANGUAGE_LABELS[opts.language] : "كل اللغات",
    المستوى: opts.level && opts.level !== "all" ? LEVEL_LABELS[opts.level] : "كل المستويات",
  };
  if (opts.trainerId && opts.trainerId !== "all") {
    const t = db.prepare("SELECT name FROM trainers WHERE id = ?").get(opts.trainerId) as
      | { name: string }
      | undefined;
    filters["المدرب"] = t?.name ?? "—";
  }

  const report: AcademicReport = {
    title: "التقرير الأكاديمي والإحصائي",
    subtitle: "نظام الدينامو لإدارة الدورات والمدربين",
    generatedAt: new Date().toISOString(),
    period: { from: opts.from ?? null, to: opts.to ?? null },
    filters,
    summary: [
      { key: "courses", label: "عدد الدورات", value: courses.length },
      { key: "students", label: "عدد الطلبة (غير مكرر)", value: distinctStudents.n },
      { key: "enrollments", label: "إجمالي التسجيلات", value: totalEnrolled },
      { key: "capacity", label: "الطاقة الاستيعابية", value: totalCapacity },
      { key: "fill", label: "نسبة الإشغال", value: pct(totalEnrolled, totalCapacity) },
      { key: "attendance", label: "متوسط نسبة الحضور", value: overall.label },
      {
        key: "sessions",
        label: "سجلات الحضور المحتسبة",
        value: allAttendance.present + allAttendance.late + allAttendance.absent + allAttendance.excused,
      },
    ],
    sections,
    disclaimer:
      "أُعِدّ هذا التقرير آليًا بصيغة أكاديمية وإحصائية بحتة، ومرّ عبر فلتر يستبعد أي بيانات مالية " +
      "(أسعار، تكاليف، هوامش، رواتب) ليكون جاهزًا للرفع للإدارة الأكاديمية مباشرة.",
    sanitiser: { removedFields: [], scannedValues: 0 },
  };

  return sanitiseReport(report);
}
