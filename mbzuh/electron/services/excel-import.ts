/**
 * استيراد بيانات التسجيل والحضور من ملفات إكسل/CSV وفرزها تلقائيًا،
 * مع إسقاط أي أعمدة مالية عند البوابة قبل دخولها قاعدة البيانات.
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { getDb, logActivity } from "../db";
import { isFinancialKey } from "./sanitiser";
import { buildSearchIndex, normalizeArabic } from "../../shared/text";
import type { ImportResult, Level } from "../../shared/types";

type Field =
  | "student_name" | "student_code" | "phone" | "email" | "gender" | "nationality"
  | "course" | "language" | "level" | "date" | "status" | "enrolled_at" | "notes";

const ALIASES: Record<Field, string[]> = {
  student_name: ["اسم الطالب", "الاسم", "اسم المتدرب", "الطالب", "المتدرب", "اسم الدارس", "name", "student", "student name", "full name"],
  student_code: ["رقم الطالب", "الرقم", "رقم الهوية", "الهوية", "رقم السجل", "id", "code", "student id", "no"],
  phone: ["الجوال", "الهاتف", "رقم الجوال", "phone", "mobile"],
  email: ["البريد", "الايميل", "البريد الالكتروني", "email"],
  gender: ["الجنس", "gender", "sex"],
  nationality: ["الجنسية", "nationality"],
  course: ["الدورة", "اسم الدورة", "رمز الدورة", "الكورس", "البرنامج", "course", "course code", "course name", "class"],
  language: ["اللغة", "لغة الدورة", "language"],
  level: ["المستوى", "المستوي", "level"],
  date: ["التاريخ", "تاريخ الحضور", "اليوم", "date", "day"],
  status: ["الحالة", "حالة الحضور", "الحضور", "status", "attendance", "present"],
  enrolled_at: ["تاريخ التسجيل", "تاريخ الالتحاق", "registration date", "enrolled at"],
  notes: ["ملاحظات", "ملاحظة", "notes", "note", "remarks"],
};

const LANGUAGE_HINTS: Record<string, string> = {
  انجليزي: "english", انجليزيه: "english", english: "english", eng: "english",
  فرنسي: "french", فرنسيه: "french", french: "french",
  روسي: "russian", روسيه: "russian", russian: "russian",
  اوردو: "urdu", urdu: "urdu",
  صيني: "chinese", صينيه: "chinese", chinese: "chinese", mandarin: "chinese",
};

const LEVEL_HINTS: [RegExp, Level][] = [
  [/الاول|اول|level ?1|\b1\b|first/, "level1"],
  [/الثاني|ثاني|level ?2|\b2\b|second/, "level2"],
  [/الثالث|ثالث|level ?3|\b3\b|third/, "level3"],
  [/الرابع|رابع|level ?4|\b4\b|fourth/, "level4"],
  [/الخامس|خامس|level ?5|\b5\b|fifth/, "level5"],
  [/السادس|سادس|level ?6|\b6\b|sixth/, "level6"],
  [/محادثه|conversation/, "conversation"],
  [/مكثف|intensive/, "intensive"],
  [/دبلوم|diploma/, "diploma"],
];

const STATUS_HINTS: [RegExp, string][] = [
  [/بعذر|عذر|excused/, "excused"],
  [/متاخر|تاخر|تاخير|late/, "late"],
  [/غائب|غياب|absent/, "absent"],
  [/حاضر|حضور|present|حضر|نعم/, "present"],
];

function matchField(header: string): Field | null {
  const n = normalizeArabic(header);
  if (!n) return null;
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    if (aliases.some((a) => n === normalizeArabic(a))) return field;
  }
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
    if (aliases.some((a) => n.includes(normalizeArabic(a)))) return field;
  }
  return null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.text) return v.text;
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(value).trim();
}

function toISODate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return null;
}

export interface SheetData {
  headers: string[];
  rows: string[][];
}

async function readSheet(filePath: string): Promise<SheetData> {
  const wb = new ExcelJS.Workbook();
  if (path.extname(filePath).toLowerCase() === ".csv") {
    await wb.csv.readFile(filePath);
  } else {
    await wb.xlsx.readFile(filePath);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("الملف لا يحتوي على أي ورقة عمل.");

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellText(cell.value);
    });
    matrix.push(Array.from(values, (v) => v ?? ""));
  });
  if (!matrix.length) throw new Error("الملف فارغ.");

  // صف العناوين = أول صف يتعرّف النظام على عمودين منه على الأقل
  let headerIndex = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const known = matrix[i].filter((h) => matchField(h)).length;
    if (known >= 2) {
      headerIndex = i;
      break;
    }
  }
  const headers = matrix[headerIndex].map((h) => (h ?? "").trim());
  const rows = matrix.slice(headerIndex + 1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  return { headers, rows };
}

export interface ImportPreview {
  filename: string;
  kind: ImportResult["kind"];
  mapping: { column: string; field: Field | null; dropped: boolean; reason?: string }[];
  droppedColumns: string[];
  rowCount: number;
  sample: Record<string, string>[];
}

function buildMapping(headers: string[]) {
  return headers.map((column) => {
    const financial = isFinancialKey(column);
    const field = financial ? null : matchField(column);
    return {
      column,
      field,
      dropped: financial,
      reason: financial ? "عمود مالي — مستبعد بواسطة فلتر الأرقام" : undefined,
    };
  });
}

function detectKind(mapping: ReturnType<typeof buildMapping>): ImportResult["kind"] {
  const fields = new Set(mapping.map((m) => m.field));
  if (fields.has("date") && fields.has("status")) return "attendance";
  if (fields.has("student_name") || fields.has("student_code")) return "registrations";
  return "unknown";
}

export async function previewImport(filePath: string): Promise<ImportPreview> {
  const { headers, rows } = await readSheet(filePath);
  const mapping = buildMapping(headers);
  const sample = rows.slice(0, 5).map((row) => {
    const obj: Record<string, string> = {};
    mapping.forEach((m, i) => {
      if (!m.dropped) obj[m.column] = row[i] ?? "";
    });
    return obj;
  });
  return {
    filename: path.basename(filePath),
    kind: detectKind(mapping),
    mapping,
    droppedColumns: mapping.filter((m) => m.dropped).map((m) => m.column),
    rowCount: rows.length,
    sample,
  };
}

interface CourseIndexEntry {
  id: number;
  code: string;
  title: string;
  language: string;
  level: string;
}

function courseIndex(): CourseIndexEntry[] {
  return getDb().prepare("SELECT id, code, title, language, level FROM courses").all() as CourseIndexEntry[];
}

function guessLanguage(raw: string): string | null {
  const n = normalizeArabic(raw);
  for (const [key, value] of Object.entries(LANGUAGE_HINTS)) {
    if (n.includes(normalizeArabic(key))) return value;
  }
  return null;
}

function guessLevel(raw: string): Level | null {
  const n = normalizeArabic(raw);
  for (const [re, level] of LEVEL_HINTS) if (re.test(n)) return level;
  return null;
}

function guessStatus(raw: string): string {
  const n = normalizeArabic(raw);
  for (const [re, status] of STATUS_HINTS) if (re.test(n)) return status;
  return "present";
}

function findCourse(
  list: CourseIndexEntry[],
  raw: string,
  langHint: string,
  levelHint: string,
): CourseIndexEntry | null {
  const n = normalizeArabic(raw);
  if (n) {
    const byCode = list.find((c) => normalizeArabic(c.code) === n);
    if (byCode) return byCode;
    const byTitle = list.find((c) => normalizeArabic(c.title) === n);
    if (byTitle) return byTitle;
    const partial = list.find(
      (c) => n.includes(normalizeArabic(c.code)) || normalizeArabic(c.title).includes(n),
    );
    if (partial) return partial;
  }
  const lang = LANGUAGE_HINTS[normalizeArabic(langHint)] ?? guessLanguage(raw);
  const level = guessLevel(`${levelHint} ${raw}`);
  if (lang && level) {
    const byPair = list.find((c) => c.language === lang && c.level === level);
    if (byPair) return byPair;
  }
  return null;
}

export interface ImportOptions {
  createMissingStudents?: boolean;
  defaultCourseId?: number | null;
}

export async function runImport(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const db = getDb();
  const { headers, rows } = await readSheet(filePath);
  const mapping = buildMapping(headers);
  const kind = detectKind(mapping);
  const colOf = (field: Field) => mapping.findIndex((m) => m.field === field);

  const idx = {
    name: colOf("student_name"),
    code: colOf("student_code"),
    phone: colOf("phone"),
    email: colOf("email"),
    gender: colOf("gender"),
    nationality: colOf("nationality"),
    course: colOf("course"),
    language: colOf("language"),
    level: colOf("level"),
    date: colOf("date"),
    status: colOf("status"),
    enrolledAt: colOf("enrolled_at"),
  };

  const result: ImportResult = {
    kind,
    filename: path.basename(filePath),
    rowsTotal: rows.length,
    rowsOk: 0,
    rowsFailed: 0,
    createdStudents: 0,
    createdEnrollments: 0,
    createdAttendance: 0,
    matchedCourses: [],
    unmatchedCourses: [],
    droppedColumns: mapping.filter((m) => m.dropped).map((m) => m.column),
    errors: [],
  };

  if (kind === "unknown") {
    result.errors.push("تعذّر التعرّف على نوع الملف: لم يُعثر على عمود لاسم الطالب أو للحضور.");
    return result;
  }

  const courses = courseIndex();
  const matched = new Set<string>();
  const unmatched = new Set<string>();

  const findStudent = db.prepare(
    "SELECT id FROM students WHERE (code IS NOT NULL AND code <> '' AND code = ?) OR search = ?",
  );
  const insertStudent = db.prepare(
    "INSERT INTO students(code, name, phone, email, gender, nationality, search) VALUES(?,?,?,?,?,?,?)",
  );
  const findEnrollment = db.prepare("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?");
  const insertEnrollment = db.prepare(
    "INSERT INTO enrollments(student_id, course_id, level, status, enrolled_at) VALUES(?,?,?,'enrolled',?)",
  );
  const upsertAttendance = db.prepare(
    "INSERT INTO attendance(enrollment_id, date, status) VALUES(?,?,?) " +
      "ON CONFLICT(enrollment_id, date) DO UPDATE SET status = excluded.status",
  );

  const tx = db.transaction(() => {
    rows.forEach((row, i) => {
      const cell = (col: number) => (col >= 0 ? (row[col] ?? "").trim() : "");
      const name = cell(idx.name);
      const code = cell(idx.code);
      if (!name && !code) {
        result.rowsFailed += 1;
        return;
      }
      const searchKey = buildSearchIndex(name);
      let studentId = (findStudent.get(code, searchKey) as { id: number } | undefined)?.id;
      if (!studentId) {
        if (options.createMissingStudents === false) {
          result.rowsFailed += 1;
          result.errors.push(`السطر ${i + 2}: الطالب «${name || code}» غير مسجّل مسبقًا.`);
          return;
        }
        studentId = Number(
          insertStudent.run(
            code || null,
            name || code,
            cell(idx.phone) || null,
            cell(idx.email) || null,
            cell(idx.gender) || null,
            cell(idx.nationality) || null,
            searchKey,
          ).lastInsertRowid,
        );
        result.createdStudents += 1;
      }

      const courseRaw = cell(idx.course);
      const course =
        findCourse(courses, courseRaw, cell(idx.language), cell(idx.level)) ??
        (options.defaultCourseId ? courses.find((c) => c.id === options.defaultCourseId) ?? null : null);
      if (!course) {
        unmatched.add(courseRaw || "(بدون اسم دورة)");
        result.rowsFailed += 1;
        return;
      }
      matched.add(`${course.code} — ${course.title}`);

      let enrollmentId = (findEnrollment.get(studentId, course.id) as { id: number } | undefined)?.id;
      if (!enrollmentId) {
        enrollmentId = Number(
          insertEnrollment.run(
            studentId,
            course.id,
            guessLevel(cell(idx.level)) ?? course.level,
            toISODate(cell(idx.enrolledAt)) ?? new Date().toISOString().slice(0, 10),
          ).lastInsertRowid,
        );
        result.createdEnrollments += 1;
      }

      if (kind === "attendance") {
        const date = toISODate(cell(idx.date));
        if (!date) {
          result.rowsFailed += 1;
          result.errors.push(`السطر ${i + 2}: تاريخ حضور غير صالح.`);
          return;
        }
        upsertAttendance.run(enrollmentId, date, guessStatus(cell(idx.status)));
        result.createdAttendance += 1;
      }
      result.rowsOk += 1;
    });
  });
  tx();

  result.matchedCourses = Array.from(matched);
  result.unmatchedCourses = Array.from(unmatched);
  if (result.errors.length > 12) result.errors = result.errors.slice(0, 12).concat(["… وأخطاء أخرى"]);

  db.prepare(
    "INSERT INTO import_logs(filename, kind, rows_total, rows_ok, rows_failed, dropped_columns, summary) VALUES(?,?,?,?,?,?,?)",
  ).run(
    result.filename,
    kind,
    result.rowsTotal,
    result.rowsOk,
    result.rowsFailed,
    result.droppedColumns.join("، ") || null,
    `طلبة جدد: ${result.createdStudents} · تسجيلات: ${result.createdEnrollments} · سجلات حضور: ${result.createdAttendance}`,
  );
  logActivity("import", null, "استيراد ملف", result.filename);
  return result;
}
