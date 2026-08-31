/** غلاف مُنمَّط حول جسر IPC المكشوف من العملية الرئيسية. */
import type {
  AcademicReport,
  AttendanceStatus,
  Availability,
  Booking,
  Conflict,
  Course,
  CourseSession,
  DashboardStats,
  ImportLog,
  ImportResult,
  MeetingMinute,
  MinuteFile,
  Partner,
  PartnerDoc,
  ReportOptions,
  Room,
  SearchHit,
  Student,
  Trainer,
} from "@shared/types";

declare global {
  interface Window {
    dynamo: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
  }
}

const call = <T,>(channel: string, ...args: unknown[]): Promise<T> =>
  window.dynamo.invoke<T>(channel, ...args);

export interface ImportPreview {
  filename: string;
  kind: ImportResult["kind"];
  mapping: { column: string; field: string | null; dropped: boolean; reason?: string }[];
  droppedColumns: string[];
  rowCount: number;
  sample: Record<string, string>[];
}

export interface EnrollmentRow {
  id: number;
  student_id: number;
  course_id: number;
  level: string | null;
  status: string;
  enrolled_at: string;
  student_name: string;
  student_code: string | null;
  attended: number;
  counted: number;
}

export interface AttendanceEntry {
  enrollment_id: number;
  student_name: string;
  student_code: string | null;
  status: AttendanceStatus | null;
}

export interface ScheduleSession {
  id: number;
  weekday: number;
  start_min: number;
  end_min: number;
  course_id: number;
  code: string;
  title: string;
  status: string;
  language: string;
  start_date: string;
  end_date: string;
  trainer_name: string | null;
  room_name: string | null;
}

export interface RoomDayView {
  date: string;
  weekday: number;
  rooms: Room[];
  courses: {
    course_id: number;
    code: string;
    title: string;
    room_id: number | null;
    start_min: number;
    end_min: number;
    trainer_name: string | null;
  }[];
  bookings: (Booking & { partner_name: string | null })[];
}

export interface SystemInfo {
  version: string;
  dbPath: string;
  dataDir: string;
  backupsDir: string;
  orgName: string;
  electron: string;
  dbSize: number;
}

export const api = {
  trainers: {
    list: (query?: string) => call<Trainer[]>("trainers:list", query),
    get: (id: number) => call<Trainer | null>("trainers:get", id),
    save: (payload: Partial<Trainer> & { availability?: Availability[] }) =>
      call<Trainer>("trainers:save", payload),
    remove: (id: number) => call<boolean>("trainers:delete", id),
  },
  rooms: {
    list: () => call<(Room & { course_count: number })[]>("rooms:list"),
    save: (payload: Partial<Room>) => call<Room>("rooms:save", payload),
    remove: (id: number) => call<boolean>("rooms:delete", id),
    dayView: (date: string) => call<RoomDayView>("rooms:dayView", date),
  },
  courses: {
    list: (filters?: { query?: string; status?: string; language?: string }) =>
      call<Course[]>("courses:list", filters ?? {}),
    get: (id: number) => call<Course | null>("courses:get", id),
    save: (payload: Partial<Course> & { sessions?: CourseSession[] }) => call<Course>("courses:save", payload),
    remove: (id: number) => call<boolean>("courses:delete", id),
  },
  conflicts: {
    all: () => call<Conflict[]>("conflicts:all"),
    course: (candidate: {
      courseId?: number | null;
      trainerId: number | null;
      roomId: number | null;
      startDate: string;
      endDate: string;
      label: string;
      sessions: { weekday: number; start_min: number; end_min: number }[];
    }) => call<Conflict[]>("conflicts:course", candidate),
    booking: (candidate: {
      bookingId?: number | null;
      roomId: number;
      date: string;
      startMin: number;
      endMin: number;
      label: string;
    }) => call<Conflict[]>("conflicts:booking", candidate),
  },
  schedule: {
    week: () => call<{ sessions: ScheduleSession[]; conflicts: Conflict[] }>("schedule:week"),
  },
  partners: {
    list: (query?: string) => call<Partner[]>("partners:list", query),
    save: (payload: Partial<Partner>) => call<Partner>("partners:save", payload),
    remove: (id: number) => call<boolean>("partners:delete", id),
  },
  partnerDocs: {
    list: (partnerId?: number) => call<PartnerDoc[]>("partnerDocs:list", partnerId),
    save: (payload: Partial<PartnerDoc> & { sourcePath?: string }) =>
      call<PartnerDoc>("partnerDocs:save", payload),
    remove: (id: number) => call<boolean>("partnerDocs:delete", id),
  },
  bookings: {
    list: (filters?: { from?: string; to?: string; roomId?: number }) =>
      call<Booking[]>("bookings:list", filters ?? {}),
    save: (payload: Partial<Booking>) =>
      call<{ booking: Booking; conflicts: Conflict[] }>("bookings:save", payload),
    remove: (id: number) => call<boolean>("bookings:delete", id),
  },
  files: {
    pick: (filters?: { name: string; extensions: string[] }[]) =>
      call<string | null>("files:pick", { filters }),
    open: (filePath: string) => call<{ ok: boolean; message: string }>("files:open", filePath),
    reveal: (filePath: string) => call<boolean>("files:reveal", filePath),
  },
  students: {
    list: (query?: string) => call<Student[]>("students:list", query),
    save: (payload: Partial<Student>) => call<Student>("students:save", payload),
    remove: (id: number) => call<boolean>("students:delete", id),
  },
  enrollments: {
    byCourse: (courseId: number) => call<EnrollmentRow[]>("enrollments:byCourse", courseId),
    save: (payload: { id?: number; student_id: number; course_id: number; level?: string; status?: string }) =>
      call<unknown>("enrollments:save", payload),
    remove: (id: number) => call<boolean>("enrollments:delete", id),
  },
  attendance: {
    forDate: (courseId: number, date: string) =>
      call<AttendanceEntry[]>("attendance:forDate", courseId, date),
    mark: (rows: { enrollment_id: number; date: string; status: string }[]) =>
      call<boolean>("attendance:mark", rows),
  },
  imports: {
    pick: () => call<string | null>("import:pick"),
    preview: (filePath: string) => call<ImportPreview>("import:preview", filePath),
    run: (filePath: string, options?: { createMissingStudents?: boolean; defaultCourseId?: number | null }) =>
      call<ImportResult>("import:run", filePath, options ?? {}),
    log: () => call<ImportLog[]>("import:log"),
    template: (kind: "registrations" | "attendance") => call<string | null>("import:template", kind),
  },
  reports: {
    sections: () => call<Record<string, string>>("reports:sections"),
    build: (options: ReportOptions) => call<AcademicReport>("reports:build", options),
    preview: (options: ReportOptions) =>
      call<{ report: AcademicReport; html: string; periodLabel: string }>("reports:preview", options),
    exportPdf: (options: ReportOptions) => call<string | null>("reports:exportPdf", options),
    exportXlsx: (options: ReportOptions) => call<string | null>("reports:exportXlsx", options),
    openFile: (filePath: string) => call<{ ok: boolean; message: string }>("reports:openFile", filePath),
  },
  minutes: {
    list: (filters?: { query?: string; trainerId?: number; from?: string; to?: string }) =>
      call<MeetingMinute[]>("minutes:list", filters ?? {}),
    get: (id: number) => call<MeetingMinute | null>("minutes:get", id),
    byTrainer: (trainerId: number) => call<MeetingMinute[]>("minutes:byTrainer", trainerId),
    save: (payload: Partial<MeetingMinute> & { trainer_ids?: number[] }) =>
      call<MeetingMinute>("minutes:save", payload),
    remove: (id: number) => call<boolean>("minutes:delete", id),
    attach: (minuteId: number, sourcePath: string, title?: string) =>
      call<MinuteFile>("minutes:attach", minuteId, sourcePath, title),
    detach: (fileId: number) => call<boolean>("minutes:detach", fileId),
  },
  dashboard: {
    stats: () => call<DashboardStats>("dashboard:stats"),
    activity: () =>
      call<{ id: number; at: string; entity: string; action: string; detail: string }[]>("activity:recent"),
  },
  search: {
    global: (query: string) => call<SearchHit[]>("search:global", query),
  },
  settings: {
    all: () => call<Record<string, string>>("settings:all"),
    set: (key: string, value: string) => call<boolean>("settings:set", key, value),
    info: () => call<SystemInfo>("system:info"),
  },
  backup: {
    list: () => call<{ path: string; size: number; created_at: string }[]>("backup:list"),
    create: () => call<{ path: string; size: number }>("backup:create"),
    exportTo: () => call<{ path: string; size: number } | null>("backup:export"),
    restore: (sourcePath?: string) => call<{ ok: boolean; message: string }>("backup:restore", sourcePath),
  },
  demo: {
    seed: () => call<{ ok: boolean; message: string }>("demo:seed"),
    reset: () => call<{ ok: boolean; message: string }>("demo:reset"),
  },
};
