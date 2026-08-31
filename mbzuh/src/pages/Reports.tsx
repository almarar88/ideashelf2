import { useCallback, useEffect, useState } from "react";
import { api, type ImportPreview } from "../lib/api";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  TabBar,
  Toolbar,
  useUi,
} from "../components/ui";
import { LANGUAGE_LABELS, LEVEL_LABELS } from "@shared/labels";
import { LANGUAGES, LEVELS } from "@shared/types";
import { formatDate, formatDateTime } from "@shared/text";
import type { AcademicReport, ImportLog, ImportResult, ReportOptions, Trainer } from "@shared/types";

export default function ReportsPage() {
  const { toast } = useUi();
  const [tab, setTab] = useState("report");

  return (
    <div>
      <PageHeader
        title="مولّد التقارير والإحصائيات الأكاديمية"
        subtitle="استورد بيانات التسجيل والحضور، ثم أصدر تقريرًا أكاديميًا صافيًا خاليًا من أي أرقام مالية"
      />
      <TabBar
        tabs={[
          { id: "report", label: "إصدار التقارير" },
          { id: "import", label: "استيراد البيانات" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "report" ? <ReportBuilder toast={toast} /> : <ImportPanel toast={toast} />}
    </div>
  );
}

/* ------------------------------ إصدار التقرير ------------------------------ */

function ReportBuilder({ toast }: { toast: (t: string, tone?: "info" | "ok" | "danger") => void }) {
  const [sections, setSections] = useState<Record<string, string>>({});
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [options, setOptions] = useState<ReportOptions>({
    from: null,
    to: null,
    language: "all",
    level: "all",
    trainerId: "all",
    includeSections: [],
  });
  const [report, setReport] = useState<AcademicReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setSections(await api.reports.sections());
      setTrainers(await api.trainers.list());
    })();
  }, []);

  const build = useCallback(async () => {
    setBusy(true);
    try {
      setReport(await api.reports.build(options));
    } finally {
      setBusy(false);
    }
  }, [options]);

  useEffect(() => {
    void build();
  }, [build]);

  const toggleSection = (id: string) => {
    const current = options.includeSections ?? [];
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    setOptions({ ...options, includeSections: next });
  };

  const exportPdf = async () => {
    const target = await api.reports.exportPdf(options);
    if (!target) return;
    toast("تم إنشاء ملف PDF", "ok");
    await api.reports.openFile(target);
  };

  const exportXlsx = async () => {
    const target = await api.reports.exportXlsx(options);
    if (!target) return;
    toast("تم إنشاء ملف Excel", "ok");
    await api.reports.openFile(target);
  };

  const activeSections = options.includeSections ?? [];

  return (
    <>
      <Panel className="mb-4">
        <Toolbar>
          <Field label="من تاريخ">
            <Input
              type="date"
              value={options.from ?? ""}
              onChange={(e) => setOptions({ ...options, from: e.target.value || null })}
              style={{ maxWidth: 170 }}
            />
          </Field>
          <Field label="إلى تاريخ">
            <Input
              type="date"
              value={options.to ?? ""}
              onChange={(e) => setOptions({ ...options, to: e.target.value || null })}
              style={{ maxWidth: 170 }}
            />
          </Field>
          <Field label="اللغة">
            <Select
              value={options.language ?? "all"}
              onChange={(e) => setOptions({ ...options, language: e.target.value as ReportOptions["language"] })}
              style={{ maxWidth: 170 }}
            >
              <option value="all">كل اللغات</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المستوى">
            <Select
              value={options.level ?? "all"}
              onChange={(e) => setOptions({ ...options, level: e.target.value as ReportOptions["level"] })}
              style={{ maxWidth: 170 }}
            >
              <option value="all">كل المستويات</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المدرب">
            <Select
              value={String(options.trainerId ?? "all")}
              onChange={(e) =>
                setOptions({ ...options, trainerId: e.target.value === "all" ? "all" : Number(e.target.value) })
              }
              style={{ maxWidth: 200 }}
            >
              <option value="all">كل المدربين</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </Toolbar>

        <div className="mb-3">
          <span className="field-label">أقسام التقرير (اتركها فارغة لتضمين كل الأقسام)</span>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(sections).map(([id, label]) => {
              const on = activeSections.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleSection(id)}
                  className="badge"
                  style={{
                    cursor: "pointer",
                    background: on ? "var(--accent-soft)" : "var(--panel-2)",
                    color: on ? "var(--accent)" : "var(--ink-2)",
                    borderColor: on ? "var(--accent)" : "var(--border)",
                  }}
                >
                  {on ? "✓ " : ""}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" onClick={() => void exportPdf()} disabled={busy}>
            تصدير PDF
          </Button>
          <Button onClick={() => void exportXlsx()} disabled={busy}>
            تصدير Excel
          </Button>
          <Button onClick={() => void build()} disabled={busy}>
            تحديث المعاينة
          </Button>
        </div>
      </Panel>

      {!report ? (
        <Panel>
          <EmptyState title="جارٍ بناء التقرير…" />
        </Panel>
      ) : (
        <>
          <Panel
            className="mb-4"
            padded
          >
            <div className="flex items-start gap-3">
              <Badge tone="accent">فلتر الأرقام</Badge>
              <div className="text-sm" style={{ color: "var(--ink-2)" }}>
                {report.disclaimer}
                <div className="mt-1" style={{ color: "var(--muted)" }}>
                  فُحصت {report.sanitiser.scannedValues} قيمة —{" "}
                  {report.sanitiser.removedFields.length === 0
                    ? "لم يُرصد أي حقل مالي."
                    : `استُبعد ${report.sanitiser.removedFields.length} حقلًا ماليًا: ${report.sanitiser.removedFields.join("، ")}`}
                </div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {report.summary.map((s) => (
              <Panel key={s.key}>
                <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
                  {s.label}
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
              </Panel>
            ))}
          </div>

          <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
            الفترة: {report.period.from || report.period.to
              ? `${formatDate(report.period.from)} – ${formatDate(report.period.to)}`
              : "كل الفترات"}{" "}
            · أُنشئ في {formatDateTime(report.generatedAt)}
          </p>

          {report.sections.map((section) => (
            <Panel key={section.id} className="mb-4" padded={false}>
              <div className="p-4 pb-2">
                <h3 className="font-bold text-sm">{section.title}</h3>
                {section.note && (
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {section.note}
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      {section.columns.map((c) => (
                        <th key={c.key} style={{ textAlign: c.align === "center" ? "center" : undefined }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length === 0 ? (
                      <tr>
                        <td colSpan={section.columns.length} className="text-center" style={{ color: "var(--muted)" }}>
                          لا توجد بيانات ضمن هذه الفترة
                        </td>
                      </tr>
                    ) : (
                      section.rows.map((row, i) => (
                        <tr key={i}>
                          {section.columns.map((c) => (
                            <td
                              key={c.key}
                              style={{ textAlign: c.align === "center" ? "center" : undefined }}
                              className={c.align === "center" ? "tabular-nums" : undefined}
                            >
                              {row[c.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </>
      )}
    </>
  );
}

/* ------------------------------ استيراد إكسل ------------------------------ */

function ImportPanel({ toast }: { toast: (t: string, tone?: "info" | "ok" | "danger") => void }) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [busy, setBusy] = useState(false);

  const loadLogs = useCallback(async () => setLogs(await api.imports.log()), []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const pick = async () => {
    const picked = await api.imports.pick();
    if (!picked) return;
    setFilePath(picked);
    setResult(null);
    setBusy(true);
    try {
      setPreview(await api.imports.preview(picked));
    } catch (err) {
      toast(`تعذّر قراءة الملف: ${(err as Error).message}`, "danger");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!filePath) return;
    setBusy(true);
    try {
      const res = await api.imports.run(filePath, { createMissingStudents: true });
      setResult(res);
      toast(
        res.rowsOk > 0 ? `تم استيراد ${res.rowsOk} سطرًا بنجاح` : "لم يُستورد أي سطر — راجع التفاصيل",
        res.rowsOk > 0 ? "ok" : "danger",
      );
      await loadLogs();
    } catch (err) {
      toast(`فشل الاستيراد: ${(err as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => void pick()} disabled={busy}>
            اختيار ملف إكسل…
          </Button>
          <Button onClick={() => void api.imports.template("registrations")}>تنزيل قالب التسجيل</Button>
          <Button onClick={() => void api.imports.template("attendance")}>تنزيل قالب الحضور</Button>
          {filePath && (
            <span className="text-sm truncate" style={{ color: "var(--muted)" }}>
              {preview?.filename ?? filePath}
            </span>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          يتعرّف النظام تلقائيًا على أعمدة الاسم والرقم والدورة والمستوى والتاريخ وحالة الحضور،
          ويُسقط أي عمود مالي قبل إدخاله لقاعدة البيانات.
        </p>
      </Panel>

      {preview && (
        <Panel className="mb-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge tone="accent">
              {preview.kind === "attendance"
                ? "كشف حضور"
                : preview.kind === "registrations"
                  ? "كشف تسجيل"
                  : "نوع غير معروف"}
            </Badge>
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {preview.rowCount} سطر · {preview.mapping.length} عمود
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void run()}
              disabled={busy || preview.kind === "unknown"}
            >
              تنفيذ الاستيراد
            </Button>
          </div>

          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {preview.mapping.map((m) => (
              <div
                key={m.column}
                className="text-sm px-3 py-2 rounded-lg"
                style={{
                  background: m.dropped ? "var(--danger-soft)" : "var(--panel-2)",
                  border: `1px solid ${m.dropped ? "var(--danger)" : "var(--border)"}`,
                }}
              >
                <div className="font-semibold truncate">{m.column}</div>
                <div className="text-xs" style={{ color: m.dropped ? "var(--danger)" : "var(--muted)" }}>
                  {m.dropped ? m.reason : m.field ? `→ ${m.field}` : "غير مرتبط — سيُتجاهل"}
                </div>
              </div>
            ))}
          </div>

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    {Object.keys(preview.sample[0]).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    <tr key={i}>
                      {Object.keys(preview.sample[0]).map((k) => (
                        <td key={k}>{row[k]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {result && (
        <Panel className="mb-4">
          <h3 className="font-bold text-sm mb-2">نتيجة الاستيراد</h3>
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Stat label="أسطر ناجحة" value={result.rowsOk} />
            <Stat label="أسطر متعذّرة" value={result.rowsFailed} />
            <Stat label="طلبة جدد" value={result.createdStudents} />
            <Stat label="تسجيلات جديدة" value={result.createdEnrollments} />
            <Stat label="سجلات حضور" value={result.createdAttendance} />
          </div>
          {result.droppedColumns.length > 0 && (
            <p className="text-sm mb-2" style={{ color: "var(--danger)" }}>
              أعمدة مالية مستبعدة: {result.droppedColumns.join("، ")}
            </p>
          )}
          {result.unmatchedCourses.length > 0 && (
            <p className="text-sm mb-2" style={{ color: "var(--warn)" }}>
              دورات لم يُعثر عليها: {result.unmatchedCourses.join("، ")} — أنشئها أولًا ثم أعد الاستيراد.
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="text-sm space-y-1" style={{ color: "var(--muted)" }}>
              {result.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel padded={false}>
        <h3 className="font-bold text-sm p-4 pb-2">سجل عمليات الاستيراد</h3>
        {logs.length === 0 ? (
          <EmptyState title="لم تُنفَّذ أي عملية استيراد بعد" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>الملف</th>
                <th>النوع</th>
                <th>التاريخ</th>
                <th>ناجحة</th>
                <th>متعذّرة</th>
                <th>أعمدة مستبعدة</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="font-semibold">{l.filename}</td>
                  <td>{l.kind === "attendance" ? "حضور" : "تسجيل"}</td>
                  <td className="text-sm tabular-nums">{formatDateTime(l.imported_at)}</td>
                  <td className="tabular-nums">{l.rows_ok}</td>
                  <td className="tabular-nums">{l.rows_failed}</td>
                  <td className="text-sm" style={{ color: "var(--muted)" }}>
                    {l.dropped_columns ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="px-3 py-2 rounded-lg"
      style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
