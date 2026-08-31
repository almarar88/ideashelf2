/**
 * فلتر الأرقام: يضمن أن أي تقرير أكاديمي يخرج من النظام خالٍ تمامًا من أي
 * بيانات مالية (أسعار، تكاليف، هوامش، عملات) قبل تصديره للإدارة الأكاديمية.
 */
import type { AcademicReport, ReportSectionTable } from "../../shared/types";
import { normalizeArabic } from "../../shared/text";

/** كلمات مفتاحية مالية بالعربية والإنجليزية. */
export const FINANCIAL_TERMS = [
  "سعر", "اسعار", "تسعير", "تكلفه", "تكاليف", "مبلغ", "مبالغ", "رسوم", "رسم",
  "فاتوره", "فواتير", "دفعه", "دفعات", "سداد", "مدفوع", "متبقي", "خصم", "عموله",
  "هامش", "ربح", "ارباح", "ايراد", "ايرادات", "مصروف", "مصاريف", "ميزانيه",
  "راتب", "رواتب", "اجر", "اجور", "مكافاه", "بدل", "ضريبه", "قيمه مضافه",
  "ريال", "دولار", "يورو", "درهم", "دينار", "جنيه", "عمله", "نقدا", "شيك",
  "price", "cost", "amount", "fee", "fees", "invoice", "payment", "paid",
  "discount", "margin", "profit", "revenue", "budget", "salary", "wage",
  "tax", "vat", "currency", "sar", "usd", "eur", "aed", "total due", "balance",
];

const CURRENCY_PATTERN = /[$€£¥﷼]|\bر\.?س\b|\bريال\b|\bدولار\b|\bSAR\b|\bUSD\b|\bEUR\b/i;

/** هل يشير اسم العمود/الحقل إلى بيانات مالية؟ */
export function isFinancialKey(label: string): boolean {
  const n = normalizeArabic(label);
  if (!n) return false;
  return FINANCIAL_TERMS.some((term) => n.includes(normalizeArabic(term)));
}

/** هل تحتوي القيمة على رمز عملة أو صيغة مالية صريحة؟ */
export function isFinancialValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return CURRENCY_PATTERN.test(value);
}

export interface SanitiseStats {
  removedFields: string[];
  scannedValues: number;
}

/** ينظّف جدول تقرير: يحذف الأعمدة المالية ويستبعد القيم ذات العملات. */
export function sanitiseSection(section: ReportSectionTable, stats: SanitiseStats): ReportSectionTable {
  const keptColumns = section.columns.filter((col) => {
    const financial = isFinancialKey(col.label) || isFinancialKey(col.key);
    if (financial) stats.removedFields.push(`${section.title} ← ${col.label}`);
    return !financial;
  });
  const keptKeys = new Set(keptColumns.map((c) => c.key));
  const rows = section.rows.map((row) => {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(row)) {
      stats.scannedValues += 1;
      if (!keptKeys.has(key)) continue;
      if (isFinancialValue(value)) {
        stats.removedFields.push(`${section.title} ← قيمة مالية في «${key}»`);
        continue;
      }
      clean[key] = value;
    }
    return clean;
  });
  return { ...section, columns: keptColumns, rows };
}

/** ينظّف التقرير بالكامل ويسجّل ما تم استبعاده. */
export function sanitiseReport(report: AcademicReport): AcademicReport {
  const stats: SanitiseStats = { removedFields: [], scannedValues: 0 };
  const sections = report.sections
    .map((s) => sanitiseSection(s, stats))
    .filter((s) => s.columns.length > 0);
  const summary = report.summary.filter((item) => {
    const financial = isFinancialKey(item.label) || isFinancialValue(item.value);
    if (financial) stats.removedFields.push(`المؤشرات ← ${item.label}`);
    stats.scannedValues += 1;
    return !financial;
  });
  return {
    ...report,
    sections,
    summary,
    sanitiser: {
      removedFields: [...new Set(stats.removedFields)],
      scannedValues: stats.scannedValues,
    },
  };
}
