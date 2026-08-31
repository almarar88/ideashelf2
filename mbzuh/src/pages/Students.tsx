import { useCallback, useEffect, useState } from "react";
import { api, type AttendanceEntry, type EnrollmentRow } from "../lib/api";
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
  TabBar,
  Textarea,
  Toolbar,
  useUi,
} from "../components/ui";
import { ATTENDANCE_LABELS } from "@shared/labels";
import { formatDate, todayISO } from "@shared/text";
import type { AttendanceStatus, Course, Student } from "@shared/types";

export default function StudentsPage({ focusId }: { focusId?: number }) {
  const { toast, confirm } = useUi();
  const [tab, setTab] = useState("attendance");
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | null>(focusId ?? null);
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Partial<Student> | null>(null);
  const [addTarget, setAddTarget] = useState<number | "">("");

  useEffect(() => {
    void api.courses.list({}).then((rows) => {
      setCourses(rows);
      setCourseId((current) => current ?? focusId ?? rows[0]?.id ?? null);
    });
  }, [focusId]);

  const loadCourseData = useCallback(async () => {
    if (!courseId) {
      setEntries([]);
      setEnrollments([]);
      return;
    }
    const [att, enr] = await Promise.all([
      api.attendance.forDate(courseId, date),
      api.enrollments.byCourse(courseId),
    ]);
    setEntries(att);
    setEnrollments(enr);
  }, [courseId, date]);

  useEffect(() => {
    void loadCourseData();
  }, [loadCourseData]);

  const loadStudents = useCallback(async () => {
    setStudents(await api.students.list(query.trim() || undefined));
  }, [query]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const mark = async (enrollmentId: number, status: AttendanceStatus) => {
    await api.attendance.mark([{ enrollment_id: enrollmentId, date, status }]);
    setEntries((rows) => rows.map((r) => (r.enrollment_id === enrollmentId ? { ...r, status } : r)));
  };

  const markAll = async (status: AttendanceStatus) => {
    if (entries.length === 0) return;
    await api.attendance.mark(entries.map((e) => ({ enrollment_id: e.enrollment_id, date, status })));
    setEntries((rows) => rows.map((r) => ({ ...r, status })));
    toast(`تم تعليم الجميع «${ATTENDANCE_LABELS[status]}»`, "ok");
  };

  const saveStudent = async () => {
    if (!draft?.name?.trim()) {
      toast("اسم الطالب مطلوب", "danger");
      return;
    }
    await api.students.save(draft);
    setDraft(null);
    toast("تم حفظ بيانات الطالب", "ok");
    await loadStudents();
  };

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  return (
    <div>
      <PageHeader
        title="الطلبة والحضور"
        subtitle="سجل الطلبة وتسجيلهم في الدورات، ورصد الحضور اليومي الذي تُبنى عليه التقارير"
        actions={<Button variant="primary" onClick={() => setDraft({ name: "" })}>+ طالب جديد</Button>}
      />

      <TabBar
        tabs={[
          { id: "attendance", label: "رصد الحضور" },
          { id: "registry", label: "سجل الطلبة", count: students.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "attendance" && (
        <>
          <Toolbar>
            <Field label="الدورة">
              <Select
                value={courseId ?? ""}
                onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
                style={{ minWidth: 300 }}
              >
                <option value="">— اختر دورة —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="التاريخ">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
            </Field>
            <Button size="sm" onClick={() => void markAll("present")}>
              تعليم الجميع حاضر
            </Button>
            <Button size="sm" onClick={() => void markAll("absent")}>
              تعليم الجميع غائب
            </Button>
          </Toolbar>

          {selectedCourse && (
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              {selectedCourse.trainer_name ?? "بدون مدرب"} · {selectedCourse.room_name ?? "بدون قاعة"} ·{" "}
              {formatDate(selectedCourse.start_date)} – {formatDate(selectedCourse.end_date)}
            </p>
          )}

          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(420px, 1.3fr) minmax(300px, 1fr)" }}>
            <Panel padded={false}>
              {entries.length === 0 ? (
                <EmptyState
                  title="لا يوجد طلبة مسجّلون في هذه الدورة"
                  hint="سجّل الطلبة يدويًا أو استورد كشف التسجيل من وحدة التقارير"
                />
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>الرقم</th>
                      <th style={{ width: 330 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.enrollment_id}>
                        <td className="font-semibold">{e.student_name}</td>
                        <td className="tabular-nums text-sm" style={{ color: "var(--muted)" }}>
                          {e.student_code ?? "—"}
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => {
                              const on = e.status === s;
                              return (
                                <button
                                  key={s}
                                  onClick={() => void mark(e.enrollment_id, s)}
                                  className="badge"
                                  style={{
                                    cursor: "pointer",
                                    background: on ? "var(--accent-soft)" : "var(--panel-2)",
                                    color: on ? "var(--accent)" : "var(--muted)",
                                    borderColor: on ? "var(--accent)" : "var(--border)",
                                    fontWeight: on ? 700 : 400,
                                  }}
                                >
                                  {ATTENDANCE_LABELS[s]}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel padded={false}>
              <div className="flex items-center justify-between p-4 pb-2">
                <h3 className="font-bold text-sm">نسب الحضور التراكمية</h3>
              </div>
              {enrollments.length === 0 ? (
                <EmptyState title="لا توجد بيانات" />
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>الحضور</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => {
                      const rate = e.counted ? Math.round((e.attended / e.counted) * 100) : null;
                      return (
                        <tr key={e.id}>
                          <td className="truncate">{e.student_name}</td>
                          <td>
                            {rate === null ? (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            ) : (
                              <Badge tone={rate >= 85 ? "ok" : rate >= 70 ? "warn" : "danger"}>{rate}%</Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={async () => {
                                if (!(await confirm(`إلغاء تسجيل «${e.student_name}» من الدورة؟`))) return;
                                await api.enrollments.remove(e.id);
                                await loadCourseData();
                              }}
                            >
                              ✕
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {courseId && (
                <div className="p-4 flex items-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <Field label="تسجيل طالب في الدورة" className="flex-1">
                    <Select value={addTarget} onChange={(e) => setAddTarget(Number(e.target.value) || "")}>
                      <option value="">— اختر طالبًا —</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    onClick={async () => {
                      if (!addTarget || !courseId) return;
                      await api.enrollments.save({ student_id: Number(addTarget), course_id: courseId });
                      setAddTarget("");
                      toast("تم تسجيل الطالب", "ok");
                      await loadCourseData();
                    }}
                  >
                    تسجيل
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {tab === "registry" && (
        <>
          <Toolbar>
            <Input
              placeholder="بحث باسم الطالب أو رقمه…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </Toolbar>
          <Panel padded={false}>
            {students.length === 0 ? (
              <EmptyState title="لا يوجد طلبة" hint="أضف طالبًا أو استورد كشف التسجيل من وحدة التقارير" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>الرقم</th>
                    <th>الاسم</th>
                    <th>الجوال</th>
                    <th>الجنس</th>
                    <th>التسجيلات</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="tabular-nums">{s.code ?? "—"}</td>
                      <td className="font-semibold">{s.name}</td>
                      <td className="tabular-nums">{s.phone ?? "—"}</td>
                      <td>{s.gender ?? "—"}</td>
                      <td className="tabular-nums">{s.enrollment_count ?? 0}</td>
                      <td>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setDraft(s)}>
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              if (!(await confirm(`حذف «${s.name}»؟`, "ستُحذف تسجيلاته وسجلات حضوره."))) return;
                              await api.students.remove(s.id);
                              await loadStudents();
                            }}
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      <Modal
        open={!!draft}
        title={draft?.id ? "تعديل بيانات طالب" : "طالب جديد"}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void saveStudent()}>
              حفظ
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="الاسم *">
              <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="رقم الطالب">
              <Input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </Field>
            <Field label="الجوال">
              <Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
            <Field label="البريد">
              <Input value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field label="الجنس">
              <Select value={draft.gender ?? ""} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
                <option value="">—</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </Select>
            </Field>
            <Field label="الجنسية">
              <Input
                value={draft.nationality ?? ""}
                onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
              />
            </Field>
            <Field label="ملاحظات" className="col-span-2">
              <Textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
