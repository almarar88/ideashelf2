/** أنواع البيانات المشتركة بين العملية الرئيسية وواجهة المستخدم. */

export const LANGUAGES = ["english", "french", "russian", "urdu", "chinese"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LEVELS = [
  "level1", "level2", "level3", "level4", "level5", "level6",
  "conversation", "intensive", "diploma",
] as const;
export type Level = (typeof LEVELS)[number];

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type CourseStatus = "planned" | "active" | "completed" | "cancelled";
export type BookingKind = "internal" | "external" | "maintenance";
export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type PartnerDocKind = "quote" | "package" | "agreement" | "profile" | "other";

export interface Availability {
  id: number;
  trainer_id: number;
  weekday: number;
  start_min: number;
  end_min: number;
  note: string | null;
}

export interface Trainer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  employment_type: string | null;
  languages: Language[];
  curricula: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  availability?: Availability[];
  course_count?: number;
}

export interface CourseSession {
  id: number;
  course_id: number;
  weekday: number;
  start_min: number;
  end_min: number;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  language: Language;
  level: Level;
  trainer_id: number | null;
  room_id: number | null;
  start_date: string;
  end_date: string;
  capacity: number;
  status: CourseStatus;
  curriculum: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sessions?: CourseSession[];
  trainer_name?: string | null;
  room_name?: string | null;
  enrolled_count?: number;
}

export interface Room {
  id: number;
  name: string;
  building: string | null;
  capacity: number;
  features: string | null;
  status: "available" | "maintenance" | "closed";
  notes: string | null;
}

export interface Partner {
  id: number;
  name: string;
  type: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
  doc_count?: number;
}

export interface PartnerDoc {
  id: number;
  partner_id: number;
  kind: PartnerDocKind;
  title: string;
  ref_no: string | null;
  issued_at: string | null;
  valid_until: string | null;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  created_at: string;
  partner_name?: string;
}

export interface Booking {
  id: number;
  room_id: number;
  title: string;
  kind: BookingKind;
  partner_id: number | null;
  course_id: number | null;
  date: string;
  start_min: number;
  end_min: number;
  status: BookingStatus;
  contact: string | null;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  room_name?: string;
  partner_name?: string | null;
}

export interface Student {
  id: number;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
  enrollment_count?: number;
}

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  level: Level | null;
  status: "enrolled" | "withdrawn" | "completed";
  enrolled_at: string;
  result_level: string | null;
  student_name?: string;
  course_title?: string;
  attendance_rate?: number;
}

export interface AttendanceRow {
  id: number;
  enrollment_id: number;
  date: string;
  status: AttendanceStatus;
}

export interface MeetingMinute {
  id: number;
  meeting_date: string;
  title: string;
  location: string | null;
  parties: string | null;
  attendees: string | null;
  agenda: string | null;
  decisions: string | null;
  curriculum_notes: string | null;
  follow_up: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  trainer_ids?: number[];
  trainer_names?: string[];
  files?: MinuteFile[];
}

export interface MinuteFile {
  id: number;
  minute_id: number;
  title: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

/** تعارض مكتشف بين حصتين أو حجزين. */
export interface Conflict {
  id: string;
  type: "trainer" | "room" | "availability" | "room_status";
  severity: "error" | "warning";
  message: string;
  weekday: number | null;
  start_min: number;
  end_min: number;
  refs: { kind: "course" | "booking"; id: number; label: string }[];
}

export interface ImportLog {
  id: number;
  filename: string;
  kind: string;
  imported_at: string;
  rows_total: number;
  rows_ok: number;
  rows_failed: number;
  dropped_columns: string | null;
  summary: string | null;
}

export interface ImportResult {
  kind: "registrations" | "attendance" | "unknown";
  filename: string;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  createdStudents: number;
  createdEnrollments: number;
  createdAttendance: number;
  matchedCourses: string[];
  unmatchedCourses: string[];
  droppedColumns: string[];
  errors: string[];
}

export interface DashboardStats {
  trainers: number;
  activeTrainers: number;
  courses: number;
  activeCourses: number;
  plannedCourses: number;
  students: number;
  enrollments: number;
  rooms: number;
  partners: number;
  minutes: number;
  bookingsThisWeek: number;
  conflicts: number;
  attendanceRate: number | null;
  byLanguage: { key: string; label: string; count: number }[];
  byLevel: { key: string; label: string; count: number }[];
  byStatus: { key: string; label: string; count: number }[];
  roomUtilisation: { room: string; hours: number }[];
  upcoming: { id: number; title: string; date: string; kind: string }[];
}

export interface ReportOptions {
  from?: string | null;
  to?: string | null;
  language?: Language | "all";
  level?: Level | "all";
  trainerId?: number | "all";
  includeSections?: string[];
}

export interface ReportSectionTable {
  id: string;
  title: string;
  columns: { key: string; label: string; align?: "start" | "center" | "end" }[];
  rows: Record<string, string | number>[];
  note?: string;
}

export interface AcademicReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  period: { from: string | null; to: string | null };
  filters: Record<string, string>;
  summary: { key: string; label: string; value: string | number; hint?: string }[];
  sections: ReportSectionTable[];
  disclaimer: string;
  sanitiser: { removedFields: string[]; scannedValues: number };
}

export interface SearchHit {
  entity: "trainer" | "course" | "minute" | "partner" | "student" | "room";
  id: number;
  title: string;
  subtitle: string;
  snippet?: string;
  date?: string;
}

export interface BackupInfo {
  path: string;
  size: number;
  created_at: string;
}
