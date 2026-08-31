import type { Language, Level, CourseStatus, BookingKind, BookingStatus, AttendanceStatus, PartnerDocKind } from "./types";

export const LANGUAGE_LABELS: Record<Language, string> = {
  english: "الإنجليزية",
  french: "الفرنسية",
  russian: "الروسية",
  urdu: "الأوردو",
  chinese: "الصينية",
};

export const LEVEL_LABELS: Record<Level, string> = {
  level1: "المستوى الأول",
  level2: "المستوى الثاني",
  level3: "المستوى الثالث",
  level4: "المستوى الرابع",
  level5: "المستوى الخامس",
  level6: "المستوى السادس",
  conversation: "المحادثة",
  intensive: "المكثّف",
  diploma: "الدبلوم",
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  planned: "مخطّط",
  active: "جارٍ",
  completed: "منتهٍ",
  cancelled: "ملغى",
};

export const BOOKING_KIND_LABELS: Record<BookingKind, string> = {
  internal: "استخدام داخلي",
  external: "جهة خارجية",
  maintenance: "صيانة",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "قيد الاعتماد",
  confirmed: "معتمد",
  cancelled: "ملغى",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "بعذر",
};

export const PARTNER_DOC_LABELS: Record<PartnerDocKind, string> = {
  quote: "عرض سعر",
  package: "حقيبة تدريبية",
  agreement: "اتفاقية شراكة",
  profile: "ملف تعريفي",
  other: "أخرى",
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available: "متاحة",
  maintenance: "تحت الصيانة",
  closed: "مغلقة",
};
