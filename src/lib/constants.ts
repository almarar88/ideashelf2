export const ROLES = ["OWNER", "MANAGER", "WORKER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PALM_STATUSES = [
  "HEALTHY",
  "SICK",
  "UNDER_TREATMENT",
  "YOUNG_SEEDLING",
  "DEAD",
] as const;
export type PalmStatus = (typeof PALM_STATUSES)[number];

export const PALM_STATUS_LABELS: Record<PalmStatus, string> = {
  HEALTHY: "سليمة",
  SICK: "مصابة",
  UNDER_TREATMENT: "تحت العلاج",
  YOUNG_SEEDLING: "فسيلة صغيرة",
  DEAD: "ميتة",
};

export const PALM_STATUS_COLORS: Record<PalmStatus, string> = {
  HEALTHY: "#16a34a",
  SICK: "#dc2626",
  UNDER_TREATMENT: "#f59e0b",
  YOUNG_SEEDLING: "#0ea5e9",
  DEAD: "#525252",
};

export const DIAGNOSIS_STATUSES = ["OPEN", "MONITORING", "TREATED", "DISMISSED"] as const;
export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];
export const DIAGNOSIS_STATUS_LABELS: Record<DiagnosisStatus, string> = {
  OPEN: "جديدة",
  MONITORING: "تحت المراقبة",
  TREATED: "تم العلاج",
  DISMISSED: "متجاهلة",
};

export const WORKER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];
export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
};

export const SALARY_STATUSES = ["PENDING", "PAID", "LATE"] as const;
export type SalaryStatus = (typeof SALARY_STATUSES)[number];
export const SALARY_STATUS_LABELS: Record<SalaryStatus, string> = {
  PENDING: "مستحق",
  PAID: "مدفوع",
  LATE: "متأخر",
};

export const EXPENSE_CATEGORIES = [
  "WATER",
  "FERTILIZER",
  "PESTICIDE",
  "EQUIPMENT",
  "MAINTENANCE",
  "FUEL",
  "LABOR",
  "UTILITIES",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  WATER: "مياه وري",
  FERTILIZER: "أسمدة",
  PESTICIDE: "مبيدات",
  EQUIPMENT: "معدات وأدوات",
  MAINTENANCE: "صيانة",
  FUEL: "وقود",
  LABOR: "عمالة",
  UTILITIES: "كهرباء وخدمات",
  OTHER: "أخرى",
};

export const EVENT_TYPES = [
  "EXPENSE",
  "SALARY",
  "IRRIGATION",
  "FERTILIZATION",
  "PESTICIDE_TREATMENT",
  "HARVEST",
  "MAINTENANCE",
  "OTHER",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  EXPENSE: "مصروف",
  SALARY: "راتب",
  IRRIGATION: "ري",
  FERTILIZATION: "تسميد",
  PESTICIDE_TREATMENT: "رش مبيدات",
  HARVEST: "حصاد",
  MAINTENANCE: "صيانة",
  OTHER: "أخرى",
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  EXPENSE: "#dc2626",
  SALARY: "#7c3aed",
  IRRIGATION: "#0ea5e9",
  FERTILIZATION: "#16a34a",
  PESTICIDE_TREATMENT: "#f59e0b",
  HARVEST: "#ca8a04",
  MAINTENANCE: "#64748b",
  OTHER: "#64748b",
};

export const RECURRENCE_TYPES = ["NONE", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];
export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  NONE: "بدون تكرار",
  WEEKLY: "أسبوعي",
  MONTHLY: "شهري",
  YEARLY: "سنوي",
};

export const LISTING_TYPES = ["SELL", "BUY"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  SELL: "للبيع",
  BUY: "مطلوب للشراء",
};

export const LISTING_STATUSES = ["ACTIVE", "SOLD", "CLOSED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: "متاح",
  SOLD: "تم البيع",
  CLOSED: "مغلق",
};

export const AUCTION_STATUSES = ["SCHEDULED", "ACTIVE", "ENDED", "CANCELLED"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
export const AUCTION_STATUS_LABELS: Record<AuctionStatus, string> = {
  SCHEDULED: "مجدول",
  ACTIVE: "جارٍ الآن",
  ENDED: "منتهي",
  CANCELLED: "ملغى",
};

export const PALM_VARIETIES = [
  "سكري",
  "خلاص",
  "برحي",
  "صقعي",
  "عجوة",
  "مجدول",
  "نبتة سيف",
  "خضراوي",
  "أخرى",
];
