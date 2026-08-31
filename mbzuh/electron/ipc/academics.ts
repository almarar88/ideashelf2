/** الوحدة الثالثة: الطلبة والتسجيل والحضور، استيراد إكسل، ومولّد التقارير. */
import path from "node:path";
import type { IpcMain } from "electron";
import { app, dialog, shell } from "electron";
import ExcelJS from "exceljs";
import { getDb, getSetting, logActivity } from "../db";
import { buildSearchIndex, formatDate } from "../../shared/text";
import { buildAcademicReport, SECTION_LABELS } from "../services/reports";
import { renderReportHtml } from "../services/report-render";
import { htmlToPdf } from "../services/pdf";
import { previewImport, runImport } from "../services/excel-import";
import type { AcademicReport, ReportOptions, Student } from "../../shared/types";

async function reportToXlsx(report: AcademicReport, target: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "الدينامو";
  wb.created = new Date();

  const summary = wb.addWorksheet("المؤشرات", { views: [{ rightToLeft: true }] });
  summary.addRow([report.title]);
  summary.addRow([report.subtitle]);
  summary.addRow([]);
  summary.addRow(["المؤشر", "القيمة"]);
  for (const item of report.summary) summary.addRow([item.label, item.value]);
  summary.getRow(4).font = { bold: true };
  summary.columns.forEach((c) => (c.width = 32));

  for (const section of report.sections) {
    const ws = wb.addWorksheet(section.title.slice(0, 28), { views: [{ rightToLeft: true }] });
    ws.addRow(section.columns.map((c) => c.label)).font = { bold: true };
    for (const row of section.rows) ws.addRow(section.columns.map((c) => row[c.key] ?? ""));
    ws.columns.forEach((c) => (c.width = 22));
  }

  await wb.xlsx.writeFile(target);
  return target;
}

export function registerAcademicsIpc(ipcMain: IpcMain): void {
  /* ----------------------------- الطلبة ----------------------------- */

  ipcMain.handle("students:list", (_e, query?: string) => {
    const db = getDb();
    const sql = `SELECT s.*, (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id) AS enrollment_count
                   FROM students s`;
    return query
      ? db.prepare(`${sql} WHERE s.search LIKE ? ORDER BY s.name LIMIT 500`).all(`%${buildSearchIndex(query)}%`)
      : db.prepare(`${sql} ORDER BY s.name LIMIT 500`).all();
  });

  ipcMain.handle("students:save", (_e, payload: Partial<Student>) => {
    const db = getDb();
    const search = buildSearchIndex(payload.name, payload.code, payload.phone, payload.email);
    const data = {
      code: payload.code ?? null,
      name: payload.name,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      gender: payload.gender ?? null,
      nationality: payload.nationality ?? null,
      notes: payload.notes ?? null,
      search,
    };
    let id = payload.id ?? 0;
    if (id) {
      db.prepare(
        `UPDATE students SET code=@code, name=@name, phone=@phone, email=@email, gender=@gender,
                nationality=@nationality, notes=@notes, search=@search WHERE id=@id`,
      ).run({ ...data, id });
    } else {
      id = Number(
        db.prepare(
          `INSERT INTO students(code, name, phone, email, gender, nationality, notes, search)
           VALUES(@code,@name,@phone,@email,@gender,@nationality,@notes,@search)`,
        ).run(data).lastInsertRowid,
      );
    }
    return db.prepare("SELECT * FROM students WHERE id = ?").get(id);
  });

  ipcMain.handle("students:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM students WHERE id = ?").run(id);
    return true;
  });

  /* --------------------- التسجيل وسجل الحضور --------------------- */

  ipcMain.handle("enrollments:byCourse", (_e, courseId: number) =>
    getDb()
      .prepare(
        `SELECT e.*, s.name AS student_name, s.code AS student_code,
                (SELECT COUNT(*) FROM attendance a WHERE a.enrollment_id = e.id AND a.status IN ('present','late')) AS attended,
                (SELECT COUNT(*) FROM attendance a WHERE a.enrollment_id = e.id AND a.status <> 'excused') AS counted
           FROM enrollments e JOIN students s ON s.id = e.student_id
          WHERE e.course_id = ? ORDER BY s.name`,
      )
      .all(courseId),
  );

  ipcMain.handle("enrollments:save", (_e, payload: { id?: number; student_id: number; course_id: number; level?: string; status?: string }) => {
    const db = getDb();
    if (payload.id) {
      db.prepare("UPDATE enrollments SET level=?, status=? WHERE id=?").run(
        payload.level ?? null,
        payload.status ?? "enrolled",
        payload.id,
      );
      return db.prepare("SELECT * FROM enrollments WHERE id = ?").get(payload.id);
    }
    const id = Number(
      db.prepare(
        `INSERT INTO enrollments(student_id, course_id, level, status, enrolled_at)
         VALUES(?,?,?,?,date('now'))
         ON CONFLICT(student_id, course_id) DO UPDATE SET status = excluded.status`,
      ).run(payload.student_id, payload.course_id, payload.level ?? null, payload.status ?? "enrolled")
        .lastInsertRowid,
    );
    return db.prepare("SELECT * FROM enrollments WHERE id = ?").get(id);
  });

  ipcMain.handle("enrollments:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM enrollments WHERE id = ?").run(id);
    return true;
  });

  ipcMain.handle("attendance:forDate", (_e, courseId: number, date: string) =>
    getDb()
      .prepare(
        `SELECT e.id AS enrollment_id, s.name AS student_name, s.code AS student_code,
                a.status AS status
           FROM enrollments e JOIN students s ON s.id = e.student_id
           LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.date = ?
          WHERE e.course_id = ? AND e.status <> 'withdrawn'
          ORDER BY s.name`,
      )
      .all(date, courseId),
  );

  ipcMain.handle("attendance:mark", (_e, rows: { enrollment_id: number; date: string; status: string }[]) => {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO attendance(enrollment_id, date, status) VALUES(?,?,?) " +
        "ON CONFLICT(enrollment_id, date) DO UPDATE SET status = excluded.status",
    );
    db.transaction(() => {
      for (const r of rows) stmt.run(r.enrollment_id, r.date, r.status);
    })();
    logActivity("attendance", null, "تسجيل حضور", `${rows.length} سجل`);
    return true;
  });

  /* --------------------------- الاستيراد --------------------------- */

  ipcMain.handle("import:pick", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "ملفات إكسل", extensions: ["xlsx", "xlsm", "csv"] }],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle("import:preview", async (_e, filePath: string) => previewImport(filePath));

  ipcMain.handle("import:run", async (_e, filePath: string, options) => runImport(filePath, options ?? {}));

  ipcMain.handle("import:log", () =>
    getDb().prepare("SELECT * FROM import_logs ORDER BY imported_at DESC LIMIT 50").all(),
  );

  /** قالب إكسل جاهز بالأعمدة التي يتوقّعها النظام. */
  ipcMain.handle("import:template", async (_e, kind: "registrations" | "attendance") => {
    const res = await dialog.showSaveDialog({
      defaultPath: path.join(
        app.getPath("documents"),
        kind === "attendance" ? "قالب-الحضور.xlsx" : "قالب-التسجيل.xlsx",
      ),
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (res.canceled || !res.filePath) return null;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("البيانات", { views: [{ rightToLeft: true }] });
    const headers =
      kind === "attendance"
        ? ["رقم الطالب", "اسم الطالب", "رمز الدورة", "التاريخ", "الحالة"]
        : ["رقم الطالب", "اسم الطالب", "الجوال", "الجنس", "رمز الدورة", "المستوى", "تاريخ التسجيل"];
    ws.addRow(headers).font = { bold: true };
    if (kind === "attendance") {
      ws.addRow(["ST-1000", "محمد العتيبي", "ENG-101", "2026-03-01", "حاضر"]);
      ws.addRow(["ST-1001", "نورة القحطاني", "ENG-101", "2026-03-01", "غائب"]);
    } else {
      ws.addRow(["ST-1000", "محمد العتيبي", "0555555555", "ذكر", "ENG-101", "المستوى الأول", "2026-02-20"]);
    }
    ws.columns.forEach((c) => (c.width = 20));
    await wb.xlsx.writeFile(res.filePath);
    return res.filePath;
  });

  /* --------------------------- التقارير --------------------------- */

  ipcMain.handle("reports:sections", () => SECTION_LABELS);

  ipcMain.handle("reports:build", (_e, options: ReportOptions) => buildAcademicReport(options ?? {}));

  ipcMain.handle("reports:exportPdf", async (_e, options: ReportOptions) => {
    const report = buildAcademicReport(options ?? {});
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath("documents"), `تقرير-أكاديمي-${stamp}.pdf`),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (res.canceled || !res.filePath) return null;
    const html = renderReportHtml(report, getSetting("org_name", "الإدارة الأكاديمية"));
    await htmlToPdf(html, res.filePath);
    logActivity("report", null, "تصدير تقرير PDF", path.basename(res.filePath));
    return res.filePath;
  });

  ipcMain.handle("reports:exportXlsx", async (_e, options: ReportOptions) => {
    const report = buildAcademicReport(options ?? {});
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath("documents"), `تقرير-أكاديمي-${stamp}.xlsx`),
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (res.canceled || !res.filePath) return null;
    await reportToXlsx(report, res.filePath);
    logActivity("report", null, "تصدير تقرير Excel", path.basename(res.filePath));
    return res.filePath;
  });

  ipcMain.handle("reports:preview", (_e, options: ReportOptions) => {
    const report = buildAcademicReport(options ?? {});
    return {
      report,
      html: renderReportHtml(report, getSetting("org_name", "الإدارة الأكاديمية")),
      periodLabel: `${formatDate(report.period.from)} – ${formatDate(report.period.to)}`,
    };
  });

  ipcMain.handle("reports:openFile", async (_e, filePath: string) => {
    const error = await shell.openPath(filePath);
    return { ok: !error, message: error };
  });
}
