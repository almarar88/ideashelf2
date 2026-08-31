/** الوحدة الثانية: الشركاء الخارجيون، ملفاتهم، وحجوزات القاعات والمرافق. */
import path from "node:path";
import fs from "node:fs";
import type { IpcMain } from "electron";
import { dialog, shell } from "electron";
import { filesDir, getDb, logActivity } from "../db";
import { buildSearchIndex } from "../../shared/text";
import { checkBookingCandidate } from "../services/conflicts";
import type { Booking, Partner, PartnerDoc } from "../../shared/types";

/** ينسخ ملفًا مرفقًا إلى مجلد بيانات التطبيق حتى يبقى متاحًا دون اعتماد على مصدره. */
export function storeFile(sourcePath: string, folder: string): { file_path: string; file_name: string } {
  const dir = path.join(filesDir(), folder);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(sourcePath);
  const target = path.join(dir, `${Date.now()}-${base}`);
  fs.copyFileSync(sourcePath, target);
  return { file_path: target, file_name: base };
}

export function registerLogisticsIpc(ipcMain: IpcMain): void {
  /* ----------------------------- الشركاء ----------------------------- */

  ipcMain.handle("partners:list", (_e, query?: string) => {
    const db = getDb();
    const sql = `SELECT p.*, (SELECT COUNT(*) FROM partner_docs d WHERE d.partner_id = p.id) AS doc_count
                   FROM partners p`;
    return query
      ? db.prepare(`${sql} WHERE p.search LIKE ? ORDER BY p.name`).all(`%${buildSearchIndex(query)}%`)
      : db.prepare(`${sql} ORDER BY p.name`).all();
  });

  ipcMain.handle("partners:save", (_e, payload: Partial<Partner>) => {
    const db = getDb();
    const search = buildSearchIndex(
      payload.name,
      payload.type,
      payload.contact_person,
      payload.phone,
      payload.email,
      payload.address,
      payload.notes,
    );
    const data = {
      name: payload.name,
      type: payload.type ?? null,
      contact_person: payload.contact_person ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      notes: payload.notes ?? null,
      status: payload.status ?? "active",
      search,
    };
    let id = payload.id ?? 0;
    if (id) {
      db.prepare(
        `UPDATE partners SET name=@name, type=@type, contact_person=@contact_person, phone=@phone,
                email=@email, address=@address, notes=@notes, status=@status, search=@search WHERE id=@id`,
      ).run({ ...data, id });
    } else {
      id = Number(
        db.prepare(
          `INSERT INTO partners(name, type, contact_person, phone, email, address, notes, status, search)
           VALUES(@name,@type,@contact_person,@phone,@email,@address,@notes,@status,@search)`,
        ).run(data).lastInsertRowid,
      );
    }
    logActivity("partner", id, payload.id ? "تعديل جهة" : "إضافة جهة", payload.name ?? "");
    return db.prepare("SELECT * FROM partners WHERE id = ?").get(id);
  });

  ipcMain.handle("partners:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM partners WHERE id = ?").run(id);
    logActivity("partner", id, "حذف جهة");
    return true;
  });

  /* ------------------------- ملفات الشركاء ------------------------- */

  ipcMain.handle("partnerDocs:list", (_e, partnerId?: number) => {
    const db = getDb();
    const sql = `SELECT d.*, p.name AS partner_name FROM partner_docs d JOIN partners p ON p.id = d.partner_id`;
    return partnerId
      ? db.prepare(`${sql} WHERE d.partner_id = ? ORDER BY d.created_at DESC`).all(partnerId)
      : db.prepare(`${sql} ORDER BY d.created_at DESC`).all();
  });

  ipcMain.handle("partnerDocs:save", async (_e, payload: Partial<PartnerDoc> & { sourcePath?: string }) => {
    const db = getDb();
    let filePath = payload.file_path ?? null;
    let fileName = payload.file_name ?? null;
    if (payload.sourcePath) {
      const stored = storeFile(payload.sourcePath, "partners");
      filePath = stored.file_path;
      fileName = stored.file_name;
    }
    const data = {
      partner_id: payload.partner_id,
      kind: payload.kind ?? "other",
      title: payload.title,
      ref_no: payload.ref_no ?? null,
      issued_at: payload.issued_at ?? null,
      valid_until: payload.valid_until ?? null,
      file_path: filePath,
      file_name: fileName,
      notes: payload.notes ?? null,
    };
    let id = payload.id ?? 0;
    if (id) {
      db.prepare(
        `UPDATE partner_docs SET partner_id=@partner_id, kind=@kind, title=@title, ref_no=@ref_no,
                issued_at=@issued_at, valid_until=@valid_until, file_path=@file_path,
                file_name=@file_name, notes=@notes WHERE id=@id`,
      ).run({ ...data, id });
    } else {
      id = Number(
        db.prepare(
          `INSERT INTO partner_docs(partner_id, kind, title, ref_no, issued_at, valid_until, file_path, file_name, notes)
           VALUES(@partner_id,@kind,@title,@ref_no,@issued_at,@valid_until,@file_path,@file_name,@notes)`,
        ).run(data).lastInsertRowid,
      );
    }
    logActivity("partner_doc", id, "حفظ ملف شراكة", payload.title ?? "");
    return db.prepare("SELECT * FROM partner_docs WHERE id = ?").get(id);
  });

  ipcMain.handle("partnerDocs:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM partner_docs WHERE id = ?").run(id);
    return true;
  });

  ipcMain.handle("files:pick", async (_e, opts: { filters?: { name: string; extensions: string[] }[] } = {}) => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: opts.filters ?? [
        { name: "كل الملفات المدعومة", extensions: ["pdf", "docx", "doc", "xlsx", "xls", "png", "jpg", "jpeg", "pptx", "txt"] },
      ],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle("files:open", async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, message: "الملف غير موجود." };
    const error = await shell.openPath(filePath);
    return { ok: !error, message: error };
  });

  ipcMain.handle("files:reveal", (_e, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
    return true;
  });

  /* ---------------------------- الحجوزات ---------------------------- */

  ipcMain.handle("bookings:list", (_e, filters: { from?: string; to?: string; roomId?: number } = {}) => {
    const db = getDb();
    const clauses: string[] = ["1=1"];
    const params: Record<string, unknown> = {};
    if (filters.from) {
      clauses.push("b.date >= @from");
      params.from = filters.from;
    }
    if (filters.to) {
      clauses.push("b.date <= @to");
      params.to = filters.to;
    }
    if (filters.roomId) {
      clauses.push("b.room_id = @roomId");
      params.roomId = filters.roomId;
    }
    return db
      .prepare(
        `SELECT b.*, r.name AS room_name, p.name AS partner_name
           FROM bookings b JOIN rooms r ON r.id = b.room_id
           LEFT JOIN partners p ON p.id = b.partner_id
          WHERE ${clauses.join(" AND ")}
          ORDER BY b.date, b.start_min`,
      )
      .all(params);
  });

  ipcMain.handle("bookings:save", (_e, payload: Partial<Booking>) => {
    const db = getDb();
    const data = {
      room_id: payload.room_id,
      title: payload.title,
      kind: payload.kind ?? "internal",
      partner_id: payload.partner_id ?? null,
      course_id: payload.course_id ?? null,
      date: payload.date,
      start_min: payload.start_min ?? 0,
      end_min: payload.end_min ?? 0,
      status: payload.status ?? "confirmed",
      contact: payload.contact ?? null,
      purpose: payload.purpose ?? null,
      notes: payload.notes ?? null,
    };
    let id = payload.id ?? 0;
    if (id) {
      db.prepare(
        `UPDATE bookings SET room_id=@room_id, title=@title, kind=@kind, partner_id=@partner_id,
                course_id=@course_id, date=@date, start_min=@start_min, end_min=@end_min,
                status=@status, contact=@contact, purpose=@purpose, notes=@notes WHERE id=@id`,
      ).run({ ...data, id });
    } else {
      id = Number(
        db.prepare(
          `INSERT INTO bookings(room_id, title, kind, partner_id, course_id, date, start_min, end_min,
                                status, contact, purpose, notes)
           VALUES(@room_id,@title,@kind,@partner_id,@course_id,@date,@start_min,@end_min,
                  @status,@contact,@purpose,@notes)`,
        ).run(data).lastInsertRowid,
      );
    }
    logActivity("booking", id, payload.id ? "تعديل حجز" : "حجز قاعة", payload.title ?? "");
    const saved = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as Booking;
    return {
      booking: saved,
      conflicts: checkBookingCandidate({
        bookingId: id,
        roomId: saved.room_id,
        date: saved.date,
        startMin: saved.start_min,
        endMin: saved.end_min,
        label: saved.title,
      }),
    };
  });

  ipcMain.handle("bookings:delete", (_e, id: number) => {
    getDb().prepare("DELETE FROM bookings WHERE id = ?").run(id);
    logActivity("booking", id, "حذف حجز");
    return true;
  });

  /** حالة إشغال القاعات في يوم محدد: دورات + حجوزات مدمجة. */
  ipcMain.handle("rooms:dayView", (_e, date: string) => {
    const db = getDb();
    const weekday = new Date(`${date}T00:00:00`).getDay();
    const courses = db
      .prepare(
        `SELECT c.id AS course_id, c.code, c.title, c.room_id, s.start_min, s.end_min, t.name AS trainer_name
           FROM course_sessions s JOIN courses c ON c.id = s.course_id
           LEFT JOIN trainers t ON t.id = c.trainer_id
          WHERE s.weekday = ? AND c.status IN ('planned','active')
            AND c.start_date <= ? AND c.end_date >= ?`,
      )
      .all(weekday, date, date);
    const bookings = db
      .prepare(
        `SELECT b.*, p.name AS partner_name FROM bookings b
           LEFT JOIN partners p ON p.id = b.partner_id
          WHERE b.date = ? AND b.status <> 'cancelled'`,
      )
      .all(date);
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY building, name").all();
    return { date, weekday, rooms, courses, bookings };
  });
}
