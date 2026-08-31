/**
 * كاشف التعارض: يحوّل الدورات والحجوزات إلى «كتل إشغال» موحّدة ثم يقارنها
 * زوجيًا لاكتشاف تعارض المدرب أو القاعة، ويتحقق كذلك من أوقات فراغ المدرب
 * ومن حالة القاعة.
 */
import { getDb } from "../db";
import { WEEKDAY_NAMES, dateRangesOverlap, minutesToLabel, overlaps } from "../../shared/text";
import type { Conflict } from "../../shared/types";

export interface OccupancyBlock {
  kind: "course" | "booking";
  id: number;
  label: string;
  trainerId: number | null;
  trainerName: string | null;
  roomId: number | null;
  roomName: string | null;
  weekday: number;
  startMin: number;
  endMin: number;
  from: string;
  to: string;
}

interface CourseRow {
  id: number;
  code: string;
  title: string;
  trainer_id: number | null;
  trainer_name: string | null;
  room_id: number | null;
  room_name: string | null;
  start_date: string;
  end_date: string;
  weekday: number;
  start_min: number;
  end_min: number;
}

interface BookingRow {
  id: number;
  title: string;
  room_id: number;
  room_name: string;
  date: string;
  start_min: number;
  end_min: number;
}

/** يجمع كل كتل الإشغال الفعلية من قاعدة البيانات (مع إمكانية استثناء دورة أو حجز). */
export function collectBlocks(opts: { excludeCourseId?: number; excludeBookingId?: number } = {}): OccupancyBlock[] {
  const db = getDb();
  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.trainer_id, t.name AS trainer_name,
              c.room_id, r.name AS room_name, c.start_date, c.end_date,
              s.weekday, s.start_min, s.end_min
         FROM courses c
         JOIN course_sessions s ON s.course_id = c.id
         LEFT JOIN trainers t ON t.id = c.trainer_id
         LEFT JOIN rooms r ON r.id = c.room_id
        WHERE c.status IN ('planned','active')`,
    )
    .all() as CourseRow[];

  const bookings = db
    .prepare(
      `SELECT b.id, b.title, b.room_id, r.name AS room_name, b.date, b.start_min, b.end_min
         FROM bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.status <> 'cancelled'`,
    )
    .all() as BookingRow[];

  const blocks: OccupancyBlock[] = [];
  for (const c of courses) {
    if (opts.excludeCourseId && c.id === opts.excludeCourseId) continue;
    blocks.push({
      kind: "course",
      id: c.id,
      label: `${c.code} — ${c.title}`,
      trainerId: c.trainer_id,
      trainerName: c.trainer_name,
      roomId: c.room_id,
      roomName: c.room_name,
      weekday: c.weekday,
      startMin: c.start_min,
      endMin: c.end_min,
      from: c.start_date,
      to: c.end_date,
    });
  }
  for (const b of bookings) {
    if (opts.excludeBookingId && b.id === opts.excludeBookingId) continue;
    const weekday = new Date(`${b.date}T00:00:00`).getDay();
    blocks.push({
      kind: "booking",
      id: b.id,
      label: b.title,
      trainerId: null,
      trainerName: null,
      roomId: b.room_id,
      roomName: b.room_name,
      weekday,
      startMin: b.start_min,
      endMin: b.end_min,
      from: b.date,
      to: b.date,
    });
  }
  return blocks;
}

function clash(a: OccupancyBlock, b: OccupancyBlock): boolean {
  return (
    a.weekday === b.weekday &&
    overlaps(a.startMin, a.endMin, b.startMin, b.endMin) &&
    dateRangesOverlap(a.from, a.to, b.from, b.to)
  );
}

function timeLabel(a: OccupancyBlock): string {
  return `${WEEKDAY_NAMES[a.weekday]} ${minutesToLabel(a.startMin)} – ${minutesToLabel(a.endMin)}`;
}

function pairConflicts(a: OccupancyBlock, b: OccupancyBlock): Conflict[] {
  if (!clash(a, b)) return [];
  const out: Conflict[] = [];
  const refs = [
    { kind: a.kind, id: a.id, label: a.label },
    { kind: b.kind, id: b.id, label: b.label },
  ];
  if (a.roomId && b.roomId && a.roomId === b.roomId) {
    out.push({
      id: `room:${a.roomId}:${a.kind}${a.id}:${b.kind}${b.id}`,
      type: "room",
      severity: "error",
      message: `القاعة «${a.roomName ?? ""}» محجوزة مرتين في ${timeLabel(a)} — «${a.label}» و«${b.label}».`,
      weekday: a.weekday,
      start_min: Math.max(a.startMin, b.startMin),
      end_min: Math.min(a.endMin, b.endMin),
      refs,
    });
  }
  if (a.trainerId && b.trainerId && a.trainerId === b.trainerId) {
    out.push({
      id: `trainer:${a.trainerId}:${a.kind}${a.id}:${b.kind}${b.id}`,
      type: "trainer",
      severity: "error",
      message: `المدرب «${a.trainerName ?? ""}» لديه دورتان في ${timeLabel(a)} — «${a.label}» و«${b.label}».`,
      weekday: a.weekday,
      start_min: Math.max(a.startMin, b.startMin),
      end_min: Math.min(a.endMin, b.endMin),
      refs,
    });
  }
  return out;
}

/** يفحص كتلة واحدة مقابل بقية الكتل + أوقات فراغ المدرب + حالة القاعة. */
export function conflictsForBlock(block: OccupancyBlock, others: OccupancyBlock[]): Conflict[] {
  const db = getDb();
  const out: Conflict[] = [];
  for (const other of others) out.push(...pairConflicts(block, other));

  if (block.trainerId) {
    const slots = db
      .prepare("SELECT weekday, start_min, end_min FROM trainer_availability WHERE trainer_id = ?")
      .all(block.trainerId) as { weekday: number; start_min: number; end_min: number }[];
    if (slots.length > 0) {
      const fits = slots.some(
        (s) => s.weekday === block.weekday && s.start_min <= block.startMin && s.end_min >= block.endMin,
      );
      if (!fits) {
        out.push({
          id: `avail:${block.trainerId}:${block.kind}${block.id}:${block.weekday}:${block.startMin}`,
          type: "availability",
          severity: "warning",
          message: `الموعد ${timeLabel(block)} خارج أوقات فراغ المدرب «${block.trainerName ?? ""}» المسجّلة.`,
          weekday: block.weekday,
          start_min: block.startMin,
          end_min: block.endMin,
          refs: [{ kind: block.kind, id: block.id, label: block.label }],
        });
      }
    }
  }

  if (block.roomId) {
    const room = db.prepare("SELECT name, status FROM rooms WHERE id = ?").get(block.roomId) as
      | { name: string; status: string }
      | undefined;
    if (room && room.status !== "available") {
      out.push({
        id: `roomstatus:${block.roomId}:${block.kind}${block.id}`,
        type: "room_status",
        severity: "warning",
        message: `القاعة «${room.name}» حالتها «${room.status === "maintenance" ? "تحت الصيانة" : "مغلقة"}» بينما هي مخصصة لـ«${block.label}».`,
        weekday: block.weekday,
        start_min: block.startMin,
        end_min: block.endMin,
        refs: [{ kind: block.kind, id: block.id, label: block.label }],
      });
    }
  }
  return out;
}

function dedupe(list: Conflict[]): Conflict[] {
  const seen = new Map<string, Conflict>();
  for (const c of list) {
    const key = c.id
      .split(":")
      .map((part) => part)
      .slice(0, 2)
      .concat([...c.refs].map((r) => `${r.kind}${r.id}`).sort())
      .join("|");
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}

/** كل التعارضات في النظام. */
export function detectAllConflicts(): Conflict[] {
  const blocks = collectBlocks();
  const out: Conflict[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) out.push(...pairConflicts(blocks[i], blocks[j]));
    out.push(...conflictsForBlock(blocks[i], []));
  }
  return dedupe(out);
}

export interface CandidateCourse {
  courseId?: number | null;
  trainerId: number | null;
  roomId: number | null;
  startDate: string;
  endDate: string;
  label: string;
  sessions: { weekday: number; start_min: number; end_min: number }[];
}

/** فحص استباقي لدورة قبل حفظها (يُستدعى من نموذج الإدخال مباشرة). */
export function checkCourseCandidate(candidate: CandidateCourse): Conflict[] {
  const db = getDb();
  const others = collectBlocks({ excludeCourseId: candidate.courseId ?? undefined });
  const trainer = candidate.trainerId
    ? (db.prepare("SELECT name FROM trainers WHERE id = ?").get(candidate.trainerId) as { name: string } | undefined)
    : undefined;
  const room = candidate.roomId
    ? (db.prepare("SELECT name FROM rooms WHERE id = ?").get(candidate.roomId) as { name: string } | undefined)
    : undefined;
  const out: Conflict[] = [];
  for (const s of candidate.sessions) {
    const block: OccupancyBlock = {
      kind: "course",
      id: candidate.courseId ?? 0,
      label: candidate.label || "دورة جديدة",
      trainerId: candidate.trainerId,
      trainerName: trainer?.name ?? null,
      roomId: candidate.roomId,
      roomName: room?.name ?? null,
      weekday: s.weekday,
      startMin: s.start_min,
      endMin: s.end_min,
      from: candidate.startDate,
      to: candidate.endDate,
    };
    out.push(...conflictsForBlock(block, others));
  }
  // تعارض داخلي بين حصص الدورة نفسها
  for (let i = 0; i < candidate.sessions.length; i++) {
    for (let j = i + 1; j < candidate.sessions.length; j++) {
      const a = candidate.sessions[i];
      const b = candidate.sessions[j];
      if (a.weekday === b.weekday && overlaps(a.start_min, a.end_min, b.start_min, b.end_min)) {
        out.push({
          id: `self:${i}:${j}`,
          type: "trainer",
          severity: "error",
          message: `حصتان متداخلتان داخل نفس الدورة يوم ${WEEKDAY_NAMES[a.weekday]}.`,
          weekday: a.weekday,
          start_min: Math.max(a.start_min, b.start_min),
          end_min: Math.min(a.end_min, b.end_min),
          refs: [],
        });
      }
    }
  }
  return dedupe(out);
}

export interface CandidateBooking {
  bookingId?: number | null;
  roomId: number;
  date: string;
  startMin: number;
  endMin: number;
  label: string;
}

/** فحص استباقي لحجز قاعة قبل حفظه. */
export function checkBookingCandidate(candidate: CandidateBooking): Conflict[] {
  const db = getDb();
  const others = collectBlocks({ excludeBookingId: candidate.bookingId ?? undefined });
  const room = db.prepare("SELECT name FROM rooms WHERE id = ?").get(candidate.roomId) as
    | { name: string }
    | undefined;
  const block: OccupancyBlock = {
    kind: "booking",
    id: candidate.bookingId ?? 0,
    label: candidate.label || "حجز جديد",
    trainerId: null,
    trainerName: null,
    roomId: candidate.roomId,
    roomName: room?.name ?? null,
    weekday: new Date(`${candidate.date}T00:00:00`).getDay(),
    startMin: candidate.startMin,
    endMin: candidate.endMin,
    from: candidate.date,
    to: candidate.date,
  };
  return dedupe(conflictsForBlock(block, others));
}
