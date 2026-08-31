/** يحوّل التقرير الأكاديمي إلى HTML مهيّأ للطباعة (A4، اتجاه من اليمين لليسار). */
import type { AcademicReport } from "../../shared/types";
import { formatDate, formatDateTime } from "../../shared/text";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderReportHtml(report: AcademicReport, orgName: string): string {
  const period =
    report.period.from || report.period.to
      ? `${formatDate(report.period.from) ?? ""} – ${formatDate(report.period.to) ?? ""}`
      : "كل الفترات";

  const summary = report.summary
    .map(
      (s) => `<div class="kpi"><span class="kpi-label">${esc(s.label)}</span>
        <span class="kpi-value">${esc(s.value)}</span></div>`,
    )
    .join("");

  const sections = report.sections
    .map((section) => {
      const head = section.columns.map((c) => `<th class="a-${c.align ?? "start"}">${esc(c.label)}</th>`).join("");
      const body = section.rows.length
        ? section.rows
            .map(
              (row) =>
                `<tr>${section.columns
                  .map((c) => `<td class="a-${c.align ?? "start"}">${esc(row[c.key] ?? "—")}</td>`)
                  .join("")}</tr>`,
            )
            .join("")
        : `<tr><td colspan="${section.columns.length}" class="empty">لا توجد بيانات ضمن هذه الفترة</td></tr>`;
      return `<section class="block">
        <h2>${esc(section.title)}</h2>
        ${section.note ? `<p class="note">${esc(section.note)}</p>` : ""}
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </section>`;
    })
    .join("");

  const filters = Object.entries(report.filters)
    .map(([k, v]) => `<span class="chip">${esc(k)}: ${esc(v)}</span>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(report.title)}</title>
<style>
  @page { size: A4; margin: 16mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Tahoma", "Arial", sans-serif; color: #14181f; margin: 0; font-size: 11pt; }
  header { border-bottom: 3px solid #0f5c58; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .brand h1 { font-size: 18pt; margin: 0 0 2px; color: #0f5c58; }
  .brand .org { font-size: 11pt; color: #566; font-weight: 600; }
  .meta { font-size: 9.5pt; color: #566; margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; }
  .chip { background: #eef4f3; border: 1px solid #d3e2e0; border-radius: 999px; padding: 2px 9px; font-size: 9pt; color: #24504c; }
  .chips { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 18px; }
  .kpi { border: 1px solid #dde3e6; border-radius: 8px; padding: 8px 10px; background: #fafcfc; }
  .kpi-label { display: block; font-size: 8.5pt; color: #667; margin-bottom: 3px; }
  .kpi-value { font-size: 15pt; font-weight: 700; color: #0f5c58; }
  .block { margin-bottom: 16px; break-inside: avoid; }
  h2 { font-size: 12.5pt; margin: 0 0 6px; color: #14322f; border-inline-start: 4px solid #0f5c58; padding-inline-start: 8px; }
  .note { font-size: 9pt; color: #667; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 1px solid #dfe5e8; padding: 5px 7px; }
  thead th { background: #0f5c58; color: #fff; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f6f9f9; }
  .a-center { text-align: center; } .a-end { text-align: end; } .a-start { text-align: start; }
  .empty { text-align: center; color: #889; padding: 12px; }
  footer { margin-top: 18px; border-top: 1px solid #dde3e6; padding-top: 8px; font-size: 8.5pt; color: #667; }
  .filter-note { background: #f2f8f7; border: 1px dashed #9dc4c0; border-radius: 8px; padding: 8px 10px; font-size: 9pt; color: #24504c; }
</style></head>
<body>
  <header>
    <div class="brand">
      <div>
        <h1>${esc(report.title)}</h1>
        <div class="org">${esc(orgName)} — ${esc(report.subtitle)}</div>
      </div>
      <div class="meta"><span>تاريخ الإصدار: ${esc(formatDateTime(report.generatedAt))}</span></div>
    </div>
    <div class="meta"><span>الفترة: ${esc(period)}</span></div>
    <div class="chips">${filters}</div>
  </header>
  <div class="kpis">${summary}</div>
  ${sections}
  <footer>
    <div class="filter-note">${esc(report.disclaimer)}
    ${
      report.sanitiser.removedFields.length
        ? ` تم استبعاد ${report.sanitiser.removedFields.length} حقلًا/قيمة ذات طابع مالي تلقائيًا.`
        : " لم يُرصد أي حقل مالي في هذا التقرير."
    }</div>
  </footer>
</body></html>`;
}
