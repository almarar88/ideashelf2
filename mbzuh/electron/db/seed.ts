/** بيانات تجريبية تُزرع عند أول تشغيل ليجد المستخدم النظام جاهزًا للاستكشاف. */
import { getDb } from "./index";
import { buildSearchIndex, datesForWeekday, todayISO } from "../../shared/text";
import { LANGUAGE_LABELS, LEVEL_LABELS } from "../../shared/labels";
import type { Language, Level } from "../../shared/types";

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FIRST = ["محمد", "أحمد", "عبدالله", "خالد", "سلطان", "فهد", "ريان", "نواف", "سارة", "نورة", "لمياء", "هند", "مها", "جواهر", "أسماء", "ريم"];
const LAST = ["العتيبي", "القحطاني", "الشمري", "الحربي", "الزهراني", "الدوسري", "المطيري", "الغامدي", "السبيعي", "البقمي"];

export function isEmptyDatabase(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS n FROM trainers").get() as { n: number };
  return row.n === 0;
}

export function seedDemoData(): void {
  const db = getDb();

  const insertTrainer = db.prepare(
    `INSERT INTO trainers(name, phone, email, employment_type, languages, curricula, notes, status, search)
     VALUES(@name, @phone, @email, @employment_type, @languages, @curricula, @notes, 'active', @search)`,
  );
  const insertAvail = db.prepare(
    "INSERT INTO trainer_availability(trainer_id, weekday, start_min, end_min, note) VALUES(?,?,?,?,?)",
  );
  const insertRoom = db.prepare(
    "INSERT INTO rooms(name, building, capacity, features, status, notes) VALUES(?,?,?,?,?,?)",
  );
  const insertCourse = db.prepare(
    `INSERT INTO courses(code, title, language, level, trainer_id, room_id, start_date, end_date,
                         capacity, status, curriculum, notes, search)
     VALUES(@code, @title, @language, @level, @trainer_id, @room_id, @start_date, @end_date,
            @capacity, @status, @curriculum, @notes, @search)`,
  );
  const insertSession = db.prepare(
    "INSERT INTO course_sessions(course_id, weekday, start_min, end_min) VALUES(?,?,?,?)",
  );
  const insertStudent = db.prepare(
    "INSERT INTO students(code, name, phone, gender, nationality, search) VALUES(?,?,?,?,?,?)",
  );
  const insertEnrollment = db.prepare(
    "INSERT INTO enrollments(student_id, course_id, level, status, enrolled_at) VALUES(?,?,?,'enrolled',?)",
  );
  const insertAttendance = db.prepare(
    "INSERT OR IGNORE INTO attendance(enrollment_id, date, status) VALUES(?,?,?)",
  );
  const insertPartner = db.prepare(
    `INSERT INTO partners(name, type, contact_person, phone, email, address, notes, status, search)
     VALUES(@name, @type, @contact_person, @phone, @email, @address, @notes, 'active', @search)`,
  );
  const insertDoc = db.prepare(
    `INSERT INTO partner_docs(partner_id, kind, title, ref_no, issued_at, valid_until, notes)
     VALUES(?,?,?,?,?,?,?)`,
  );
  const insertBooking = db.prepare(
    `INSERT INTO bookings(room_id, title, kind, partner_id, date, start_min, end_min, status, contact, purpose)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertMinute = db.prepare(
    `INSERT INTO minutes(meeting_date, title, location, parties, attendees, agenda, decisions,
                         curriculum_notes, follow_up, tags, search)
     VALUES(@meeting_date, @title, @location, @parties, @attendees, @agenda, @decisions,
            @curriculum_notes, @follow_up, @tags, @search)`,
  );
  const linkMinute = db.prepare("INSERT OR IGNORE INTO minute_trainers(minute_id, trainer_id) VALUES(?,?)");

  const tx = db.transaction(() => {
    const trainers: { id: number; name: string; lang: Language }[] = [];
    const trainerSeed: { name: string; lang: Language; curricula: string; type: string }[] = [
      { name: "أ. سامي العتيبي", lang: "english", curricula: "Headway / منهج المحادثة التفاعلي", type: "متفرغ" },
      { name: "أ. مريم الأنصاري", lang: "french", curricula: "Alter Ego + / DELF A1-B1", type: "متعاون" },
      { name: "أ. إيغور بيتروف", lang: "russian", curricula: "Поехали! المستويات 1-3", type: "متعاون" },
      { name: "أ. بلال أحمد", lang: "urdu", curricula: "منهج الأوردو التأسيسي + المحادثة", type: "متفرغ" },
      { name: "أ. لي وين", lang: "chinese", curricula: "HSK 1-3 / كتاب المحادثة الصينية", type: "متعاون" },
      { name: "أ. هيا الشمري", lang: "english", curricula: "IELTS Preparation / Academic Writing", type: "متفرغ" },
    ];
    for (const t of trainerSeed) {
      const id = Number(
        insertTrainer.run({
          name: t.name,
          phone: `05${Math.floor(10000000 + Math.random() * 89999999)}`,
          email: null,
          employment_type: t.type,
          languages: JSON.stringify([t.lang]),
          curricula: t.curricula,
          notes: null,
          search: buildSearchIndex(t.name, LANGUAGE_LABELS[t.lang], t.curricula, t.type),
        }).lastInsertRowid,
      );
      trainers.push({ id, name: t.name, lang: t.lang });
      for (const day of [0, 1, 2, 3, 4]) {
        insertAvail.run(id, day, 8 * 60, 14 * 60, "الفترة الصباحية");
        insertAvail.run(id, day, 16 * 60, 21 * 60, "الفترة المسائية");
      }
    }

    const rooms = [
      ["قاعة الأندلس", "المبنى أ", 25, "بروجكتر، سبورة ذكية"],
      ["قاعة النهضة", "المبنى أ", 20, "بروجكتر"],
      ["قاعة الرواد", "المبنى ب", 30, "نظام صوتي، بروجكتر"],
      ["معمل اللغات 1", "المبنى ب", 16, "16 جهاز حاسب، سماعات"],
      ["معمل اللغات 2", "المبنى ب", 16, "16 جهاز حاسب، سماعات"],
      ["قاعة الاجتماعات", "الإدارة", 12, "شاشة عرض، اتصال مرئي"],
    ] as const;
    const roomIds = rooms.map((r) => Number(insertRoom.run(r[0], r[1], r[2], r[3], "available", null).lastInsertRowid));

    const courseSeed: {
      code: string;
      lang: Language;
      level: Level;
      trainer: number;
      room: number;
      days: number[];
      start: number;
      end: number;
      status: string;
      offset: number;
      length: number;
    }[] = [
      { code: "ENG-101", lang: "english", level: "level1", trainer: 0, room: 0, days: [0, 2, 4], start: 8 * 60, end: 10 * 60, status: "active", offset: -30, length: 60 },
      { code: "ENG-201", lang: "english", level: "level2", trainer: 0, room: 1, days: [1, 3], start: 17 * 60, end: 19 * 60, status: "active", offset: -20, length: 70 },
      { code: "ENG-IELTS", lang: "english", level: "intensive", trainer: 5, room: 2, days: [0, 1, 2, 3], start: 18 * 60, end: 20 * 60, status: "active", offset: -14, length: 45 },
      { code: "FRA-101", lang: "french", level: "level1", trainer: 1, room: 1, days: [0, 2], start: 10 * 60 + 30, end: 12 * 60 + 30, status: "active", offset: -25, length: 65 },
      { code: "FRA-301", lang: "french", level: "level3", trainer: 1, room: 3, days: [1, 3], start: 9 * 60, end: 11 * 60, status: "planned", offset: 10, length: 60 },
      { code: "RUS-101", lang: "russian", level: "level1", trainer: 2, room: 2, days: [1, 3], start: 16 * 60, end: 18 * 60, status: "active", offset: -18, length: 60 },
      { code: "URD-101", lang: "urdu", level: "level1", trainer: 3, room: 4, days: [4, 6], start: 9 * 60, end: 11 * 60, status: "active", offset: -22, length: 60 },
      { code: "CHN-101", lang: "chinese", level: "level1", trainer: 4, room: 0, days: [1, 3], start: 12 * 60, end: 14 * 60, status: "active", offset: -28, length: 70 },
      { code: "CHN-201", lang: "chinese", level: "level2", trainer: 4, room: 3, days: [0, 2], start: 17 * 60, end: 19 * 60, status: "planned", offset: 15, length: 60 },
      { code: "ENG-CONV", lang: "english", level: "conversation", trainer: 5, room: 2, days: [5], start: 10 * 60, end: 13 * 60, status: "completed", offset: -120, length: 60 },
    ];

    const courseIds: { id: number; days: number[]; start: string; end: string; level: Level }[] = [];
    for (const c of courseSeed) {
      const startDate = shift(c.offset);
      const endDate = shift(c.offset + c.length);
      const title = `${LANGUAGE_LABELS[c.lang]} — ${LEVEL_LABELS[c.level]}`;
      const id = Number(
        insertCourse.run({
          code: c.code,
          title,
          language: c.lang,
          level: c.level,
          trainer_id: trainers[c.trainer].id,
          room_id: roomIds[c.room],
          start_date: startDate,
          end_date: endDate,
          capacity: 20,
          status: c.status,
          curriculum: `خطة ${LEVEL_LABELS[c.level]} — 60 ساعة تدريبية موزعة على الفصل.`,
          notes: null,
          search: buildSearchIndex(c.code, title, LANGUAGE_LABELS[c.lang], LEVEL_LABELS[c.level], trainers[c.trainer].name),
        }).lastInsertRowid,
      );
      for (const day of c.days) insertSession.run(id, day, c.start, c.end);
      courseIds.push({ id, days: c.days, start: startDate, end: endDate, level: c.level });
    }

    const studentIds: number[] = [];
    for (let i = 0; i < 48; i++) {
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
      studentIds.push(
        Number(
          insertStudent.run(
            `ST-${1000 + i}`,
            name,
            `05${Math.floor(10000000 + Math.random() * 89999999)}`,
            i % 3 === 0 ? "أنثى" : "ذكر",
            "سعودي",
            buildSearchIndex(name, `ST-${1000 + i}`),
          ).lastInsertRowid,
        ),
      );
    }

    const today = todayISO();
    let cursor = 0;
    for (const course of courseIds) {
      const size = 8 + Math.floor(Math.random() * 9);
      for (let i = 0; i < size; i++) {
        const studentId = studentIds[(cursor + i) % studentIds.length];
        const existing = db
          .prepare("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?")
          .get(studentId, course.id) as { id: number } | undefined;
        if (existing) continue;
        const enrollmentId = Number(
          insertEnrollment.run(studentId, course.id, course.level, course.start).lastInsertRowid,
        );
        for (const day of course.days) {
          const dates = datesForWeekday(course.start, course.end < today ? course.end : today, day).slice(-6);
          for (const date of dates) {
            const roll = Math.random();
            const status = roll > 0.86 ? "absent" : roll > 0.79 ? "late" : roll > 0.76 ? "excused" : "present";
            insertAttendance.run(enrollmentId, date, status);
          }
        }
      }
      cursor += size;
    }

    const partnerSeed = [
      { name: "معهد الأفق للغات", type: "معهد لغات", contact: "أ. عبدالرحمن الحارثي" },
      { name: "المركز الثقافي الفرنسي", type: "مركز ثقافي", contact: "Mme. Claire Dubois" },
      { name: "شركة تنمية الكفاءات", type: "جهة تدريب", contact: "أ. طارق النعيمي" },
      { name: "جامعة الملك سعود — كلية اللغات", type: "جهة أكاديمية", contact: "د. منى العمري" },
    ];
    const partnerIds = partnerSeed.map((p) =>
      Number(
        insertPartner.run({
          name: p.name,
          type: p.type,
          contact_person: p.contact,
          phone: `011${Math.floor(1000000 + Math.random() * 8999999)}`,
          email: null,
          address: "الرياض",
          notes: null,
          search: buildSearchIndex(p.name, p.type, p.contact),
        }).lastInsertRowid,
      ),
    );

    insertDoc.run(partnerIds[0], "quote", "عرض تدريب لغة إنجليزية — دفعة 30 متدربًا", "Q-2201", shift(-40), shift(50), "مرفق أصل العرض في ملف الجهة");
    insertDoc.run(partnerIds[0], "package", "حقيبة تدريبية: الإنجليزية للأعمال", "PKG-11", shift(-60), null, "12 وحدة تدريبية");
    insertDoc.run(partnerIds[1], "agreement", "اتفاقية تعاون لتدريس الفرنسية", "AGR-07", shift(-90), shift(275), "تجدد سنويًا");
    insertDoc.run(partnerIds[2], "quote", "عرض استئجار قاعات لدورة خارجية", "Q-3310", shift(-10), shift(20), null);
    insertDoc.run(partnerIds[3], "profile", "الملف التعريفي لكلية اللغات", null, shift(-120), null, null);

    insertBooking.run(roomIds[2], "ورشة الترجمة التتابعية — معهد الأفق", "external", partnerIds[0], shift(3), 9 * 60, 13 * 60, "confirmed", "أ. عبدالرحمن الحارثي", "استئجار قاعة ليوم واحد");
    insertBooking.run(roomIds[5], "اجتماع لجنة المناهج", "internal", null, shift(1), 11 * 60, 12 * 60 + 30, "confirmed", null, "مراجعة خطة المستوى الثالث");
    insertBooking.run(roomIds[4], "صيانة أجهزة المعمل", "maintenance", null, shift(6), 8 * 60, 15 * 60, "pending", null, "تحديث أنظمة الحاسب");
    insertBooking.run(roomIds[1], "اختبار تحديد مستوى — جامعة الملك سعود", "external", partnerIds[3], shift(9), 16 * 60, 18 * 60, "pending", "د. منى العمري", "اختبار تحديد مستوى لـ40 متقدمًا");

    const minuteSeed = [
      {
        title: "اجتماع تصميم منهج المستوى الأول — الصينية",
        trainer: 4,
        agenda: "مراجعة كتاب HSK1 وتوزيع الوحدات على 60 ساعة.",
        decisions: "اعتماد 12 وحدة، وإضافة حصة محادثة أسبوعية، وتأجيل وحدة الكتابة إلى المستوى الثاني.",
        curriculum: "توزيع الساعات: 24 استماع ومحادثة، 20 مفردات، 16 قواعد.",
        follow: "تسليم الخطة النهائية خلال أسبوعين.",
      },
      {
        title: "اجتماع توزيع مستويات الإنجليزية للفصل القادم",
        trainer: 0,
        agenda: "توزيع المستويات على المدربين وتفادي تعارض الجداول.",
        decisions: "المستوى الأول صباحًا مع أ. سامي، والمستوى الثاني مساءً، وفتح شعبة محادثة يوم الجمعة.",
        curriculum: "تثبيت منهج Headway مع ملحق محادثة داخلي.",
        follow: "مراجعة الجدول بعد اكتمال التسجيل.",
      },
      {
        title: "اجتماع مع المركز الثقافي الفرنسي",
        trainer: 1,
        agenda: "التنسيق حول اختبارات DELF ومواءمة المنهج.",
        decisions: "اعتماد Alter Ego + كمرجع أساسي، وتنظيم اختبار تجريبي نهاية الفصل.",
        curriculum: "إضافة وحدتين للتحضير لاختبار A2.",
        follow: "تحديد موعد الاختبار التجريبي.",
      },
      {
        title: "مراجعة منهج الأوردو التأسيسي",
        trainer: 3,
        agenda: "تقييم المنهج الحالي بعد الدفعة الأولى.",
        decisions: "تبسيط وحدة الخط، وزيادة تمارين الاستماع، وإعداد ملزمة مفردات يومية.",
        curriculum: "إعادة ترتيب الوحدات: الحروف ثم المفردات ثم التراكيب.",
        follow: "تسليم الملزمة قبل بداية الدفعة الثانية.",
      },
      {
        title: "اجتماع لجنة الجودة — الروسية",
        trainer: 2,
        agenda: "متابعة نسب الحضور ومستوى الاختبارات.",
        decisions: "إضافة اختبار قصير كل أسبوعين، وربط الحضور بشهادة الإتمام.",
        curriculum: "لا تغيير جوهري على المنهج هذا الفصل.",
        follow: "رفع تقرير الحضور شهريًا.",
      },
    ];
    minuteSeed.forEach((m, i) => {
      const trainer = trainers[m.trainer];
      const id = Number(
        insertMinute.run({
          meeting_date: shift(-7 * (i + 1)),
          title: m.title,
          location: "قاعة الاجتماعات — الإدارة",
          parties: `إدارة البرامج، ${trainer.name}`,
          attendees: `مدير البرامج، ${trainer.name}, منسق الجودة`,
          agenda: m.agenda,
          decisions: m.decisions,
          curriculum_notes: m.curriculum,
          follow_up: m.follow,
          tags: "تصميم مناهج، توزيع مستويات",
          search: buildSearchIndex(m.title, trainer.name, m.agenda, m.decisions, m.curriculum, m.follow, "تصميم مناهج"),
        }).lastInsertRowid,
      );
      linkMinute.run(id, trainer.id);
    });
  });

  tx();
}
