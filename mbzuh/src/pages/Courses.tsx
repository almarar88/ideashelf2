import { useCallback, useEffect, useState } from "react";
import { api, type EnrollmentRow } from "../lib/api";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Textarea,
  Toolbar,
  useUi,
} from "../components/ui";
import { COURSE_STATUS_LABELS, LANGUAGE_LABELS, LEVEL_LABELS } from "@shared/labels";
import { LANGUAGES, LEVELS } from "@shared/types";
import {
  WEEKDAY_NAMES,
  formatDate,
  minutesToLabel,
  minutesToTimeInput,
  timeInputToMinutes,
  todayISO,
} from "@shared/text";
import type { Conflict, Course, CourseSession, Room, Trainer } from "@shared/types";
import type { PageId } from "../App";

type Draft = Partial<Course> & { sessions: CourseSession[] };

const EMPTY_DRAFT = (): Draft => ({
  code: "",
  title: "",
  language: "english",
  level: "level1",
  trainer_id: null,
  room_id: null,
  start_date: todayISO(),
  end_date: todayISO(),
  capacity: 20,
  status: "planned",
  curriculum: "",
  notes: "",
  sessions: [],
});

export default function CoursesPage({
  focusId,
  onNavigate,
}: {
  focusId?: number;
  onNavigate: (page: PageId, id?: number) => void;
}) {
  const { toast, confirm } = useUi();
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [selected, setSelected] = useState<Course | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(
    async (keepId?: number) => {
      const rows = await api.courses.list({ query: query.trim() || undefined, status, language });
      setCourses(rows);
      const target = keepId ?? selected?.id ?? focusId;
      setSelected(rows.find((r) => r.id === target) ?? rows[0] ?? null);
    },
    [query, status, language, selected?.id, focusId],
  );

  useEffect(() => {
    void load(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, language, focusId]);

  useEffect(() => {
    void (async () => {
      setTrainers(await api.trainers.list());
      setRooms(await api.rooms.list());
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setEnrollments([]);
      return;
    }
    void api.enrollments.byCourse(selected.id).then(setEnrollments);
  }, [selected]);

  const remove = async (course: Course) => {
    const ok = await confirm(`حذف الدورة «${course.code}»؟`, "سيتم حذف تسجيلات الطلبة وسجلات الحضور المرتبطة بها.");
    if (!ok) return;
    await api.courses.remove(course.id);
    setSelected(null);
    toast("تم حذف الدورة", "ok");
    await load();
  };

  return (
    <div>
      <PageHeader
        title="منسق المستويات"
        subtitle="خطة كل دورة: اللغة والمستوى، المدرب، القاعة، تواريخ البداية والنهاية والحصص الأسبوعية"
        actions={
          <>
            <Button onClick={() => onNavigate("schedule")}>الجدول الأسبوعي</Button>
            <Button variant="primary" onClick={() => setDraft(EMPTY_DRAFT())}>
              + دورة جديدة
            </Button>
          </>
        }
      />

      <Toolbar>
        <Input
          placeholder="بحث برمز الدورة أو العنوان…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">كل الحالات</option>
          {Object.entries(COURSE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">كل اللغات</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </Select>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {courses.length} دورة
        </span>
      </Toolbar>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(420px, 1.3fr) minmax(320px, 1fr)" }}>
        <Panel padded={false}>
          <div className="scroll-y" style={{ maxHeight: "calc(100vh - 260px)" }}>
            {courses.length === 0 ? (
              <EmptyState title="لا توجد دورات" hint="أنشئ خطة دورة جديدة لتظهر هنا" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>الدورة</th>
                    <th>المدرب</th>
                    <th>القاعة</th>
                    <th>المسجلون</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      style={{
                        cursor: "pointer",
                        background:
                          selected?.id === c.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
                      }}
                    >
                      <td className="font-semibold tabular-nums">{c.code}</td>
                      <td>
                        <div className="truncate">{c.title}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          {LANGUAGE_LABELS[c.language]} · {LEVEL_LABELS[c.level]}
                        </div>
                      </td>
                      <td className="text-sm">{c.trainer_name ?? "—"}</td>
                      <td className="text-sm">{c.room_name ?? "—"}</td>
                      <td className="tabular-nums">
                        {c.enrolled_count ?? 0}
                        <span style={{ color: "var(--muted)" }}>/{c.capacity}</span>
                      </td>
                      <td>
                        <Badge
                          tone={c.status === "active" ? "ok" : c.status === "cancelled" ? "danger" : "default"}
                        >
                          {COURSE_STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {!selected ? (
            <Panel>
              <EmptyState title="اختر دورة لعرض تفاصيلها" />
            </Panel>
          ) : (
            <>
              <Panel>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate">{selected.title}</h2>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {selected.code} · {formatDate(selected.start_date)} – {formatDate(selected.end_date)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setDraft({ ...selected, sessions: selected.sessions ?? [] })}
                    >
                      تعديل
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(selected)}>
                      حذف
                    </Button>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap mb-3">
                  <Badge tone="accent">{LANGUAGE_LABELS[selected.language]}</Badge>
                  <Badge>{LEVEL_LABELS[selected.level]}</Badge>
                  <Badge>{selected.trainer_name ?? "بدون مدرب"}</Badge>
                  <Badge>{selected.room_name ?? "بدون قاعة"}</Badge>
                </div>

                <div className="mb-3">
                  <span className="field-label">الحصص الأسبوعية</span>
                  {(selected.sessions ?? []).length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      لم تُحدَّد حصص أسبوعية.
                    </p>
                  ) : (
                    <ul className="text-sm space-y-1" style={{ color: "var(--ink-2)" }}>
                      {(selected.sessions ?? []).map((s) => (
                        <li key={s.id}>
                          {WEEKDAY_NAMES[s.weekday]}: {minutesToLabel(s.start_min)} – {minutesToLabel(s.end_min)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selected.curriculum && (
                  <div>
                    <span className="field-label">خطة المنهج</span>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
                      {selected.curriculum}
                    </p>
                  </div>
                )}
              </Panel>

              <Panel>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">المسجلون ({enrollments.length})</h3>
                  <Button size="sm" onClick={() => onNavigate("students", selected.id)}>
                    إدارة الحضور
                  </Button>
                </div>
                {enrollments.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    لا يوجد طلبة مسجّلون — يمكنك استيراد كشف التسجيل من وحدة التقارير.
                  </p>
                ) : (
                  <ul className="space-y-1.5 scroll-y" style={{ maxHeight: 320 }}>
                    {enrollments.map((e) => {
                      const rate = e.counted ? Math.round((e.attended / e.counted) * 100) : null;
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{e.student_name}</span>
                          <span className="shrink-0 tabular-nums text-xs" style={{ color: "var(--muted)" }}>
                            {rate === null ? "بدون حضور" : `حضور ${rate}%`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>

      {draft && (
        <CourseEditor
          draft={draft}
          trainers={trainers}
          rooms={rooms}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSaved={async (id) => {
            setDraft(null);
            toast("تم حفظ الدورة", "ok");
            await load(id);
          }}
        />
      )}
    </div>
  );
}

function CourseEditor({
  draft,
  trainers,
  rooms,
  onChange,
  onClose,
  onSaved,
}: {
  draft: Draft;
  trainers: Trainer[];
  rooms: Room[];
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSaved: (id: number) => void | Promise<void>;
}) {
  const { toast } = useUi();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (!draft.start_date || !draft.end_date || draft.sessions.length === 0) {
        setConflicts([]);
        return;
      }
      setConflicts(
        await api.conflicts.course({
          courseId: draft.id ?? null,
          trainerId: draft.trainer_id ?? null,
          roomId: draft.room_id ?? null,
          startDate: draft.start_date,
          endDate: draft.end_date,
          label: `${draft.code ?? ""} — ${draft.title ?? ""}`,
          sessions: draft.sessions.map((s) => ({
            weekday: s.weekday,
            start_min: s.start_min,
            end_min: s.end_min,
          })),
        }),
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft]);

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  const addSession = () =>
    set({
      sessions: [
        ...draft.sessions,
        { id: -Date.now(), course_id: draft.id ?? 0, weekday: 0, start_min: 17 * 60, end_min: 19 * 60 },
      ],
    });

  const updateSession = (i: number, patch: Partial<CourseSession>) =>
    set({ sessions: draft.sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const save = async () => {
    if (!draft.code?.trim() || !draft.title?.trim()) {
      toast("رمز الدورة وعنوانها مطلوبان", "danger");
      return;
    }
    if ((draft.start_date ?? "") > (draft.end_date ?? "")) {
      toast("تاريخ البداية يجب أن يسبق تاريخ النهاية", "danger");
      return;
    }
    const saved = await api.courses.save(draft);
    await onSaved(saved.id);
  };

  return (
    <Modal
      open
      title={draft.id ? "تعديل خطة الدورة" : "دورة جديدة"}
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={() => void save()}>
            {errors.length ? "حفظ رغم التعارض" : "حفظ"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Field label="رمز الدورة *">
          <Input value={draft.code ?? ""} onChange={(e) => set({ code: e.target.value })} placeholder="ENG-101" />
        </Field>
        <Field label="عنوان الدورة *" className="col-span-2">
          <Input value={draft.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="اللغة">
          <Select
            value={draft.language}
            onChange={(e) => {
              const lang = e.target.value as Course["language"];
              set({
                language: lang,
                title:
                  !draft.title || draft.title.includes("—")
                    ? `${LANGUAGE_LABELS[lang]} — ${LEVEL_LABELS[draft.level ?? "level1"]}`
                    : draft.title,
              });
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المستوى">
          <Select
            value={draft.level}
            onChange={(e) => {
              const level = e.target.value as Course["level"];
              set({
                level,
                title:
                  !draft.title || draft.title.includes("—")
                    ? `${LANGUAGE_LABELS[draft.language ?? "english"]} — ${LEVEL_LABELS[level]}`
                    : draft.title,
              });
            }}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={draft.status} onChange={(e) => set({ status: e.target.value as Course["status"] })}>
            {Object.entries(COURSE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المدرب">
          <Select
            value={draft.trainer_id ?? ""}
            onChange={(e) => set({ trainer_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— غير مسند —</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="القاعة">
          <Select
            value={draft.room_id ?? ""}
            onChange={(e) => set({ room_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— بدون قاعة —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.capacity})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الطاقة الاستيعابية">
          <Input
            type="number"
            min={0}
            value={draft.capacity ?? 0}
            onChange={(e) => set({ capacity: Number(e.target.value) })}
          />
        </Field>
        <Field label="تاريخ البداية">
          <Input type="date" value={draft.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value })} />
        </Field>
        <Field label="تاريخ النهاية">
          <Input type="date" value={draft.end_date ?? ""} onChange={(e) => set({ end_date: e.target.value })} />
        </Field>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="field-label m-0">الحصص الأسبوعية</span>
          <Button size="sm" onClick={addSession}>
            + إضافة حصة
          </Button>
        </div>
        {draft.sessions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            أضف حصة واحدة على الأقل ليتمكن النظام من كشف التعارض وبناء الجدول.
          </p>
        ) : (
          <div className="space-y-2">
            {draft.sessions.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={s.weekday}
                  onChange={(e) => updateSession(i, { weekday: Number(e.target.value) })}
                  style={{ maxWidth: 140 }}
                >
                  {WEEKDAY_NAMES.map((d, idx) => (
                    <option key={d} value={idx}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Input
                  type="time"
                  value={minutesToTimeInput(s.start_min)}
                  onChange={(e) => updateSession(i, { start_min: timeInputToMinutes(e.target.value) })}
                  style={{ maxWidth: 140 }}
                />
                <Input
                  type="time"
                  value={minutesToTimeInput(s.end_min)}
                  onChange={(e) => updateSession(i, { end_min: timeInputToMinutes(e.target.value) })}
                  style={{ maxWidth: 140 }}
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => set({ sessions: draft.sessions.filter((_, idx) => idx !== i) })}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div
          className="mt-4 p-3 rounded-xl"
          style={{
            background: errors.length ? "var(--danger-soft)" : "var(--warn-soft)",
            border: `1px solid ${errors.length ? "var(--danger)" : "var(--warn)"}`,
          }}
        >
          <div className="font-bold text-sm mb-1" style={{ color: errors.length ? "var(--danger)" : "var(--warn)" }}>
            {errors.length ? `⚠ ${errors.length} تعارض` : `تنبيه (${warnings.length})`}
          </div>
          <ul className="text-sm space-y-1" style={{ color: "var(--ink-2)" }}>
            {[...errors, ...warnings].map((c) => (
              <li key={c.id}>• {c.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="خطة المنهج">
          <Textarea value={draft.curriculum ?? ""} onChange={(e) => set({ curriculum: e.target.value })} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
