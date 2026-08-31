import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
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
import { LANGUAGE_LABELS } from "@shared/labels";
import { LANGUAGES } from "@shared/types";
import { WEEKDAY_NAMES, minutesToLabel, minutesToTimeInput, timeInputToMinutes } from "@shared/text";
import type { Availability, Course, Language, MeetingMinute, Trainer } from "@shared/types";
import type { PageId } from "../App";

const EMPTY: Partial<Trainer> & { availability: Availability[] } = {
  name: "",
  phone: "",
  email: "",
  employment_type: "متفرغ",
  languages: [],
  curricula: "",
  notes: "",
  status: "active",
  availability: [],
};

export default function TrainersPage({
  focusId,
  onNavigate,
}: {
  focusId?: number;
  onNavigate: (page: PageId, id?: number, query?: string) => void;
}) {
  const { toast, confirm } = useUi();
  const [list, setList] = useState<Trainer[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Trainer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [editor, setEditor] = useState<(Partial<Trainer> & { availability: Availability[] }) | null>(null);

  const load = useCallback(
    async (keepId?: number) => {
      const rows = await api.trainers.list(query.trim() || undefined);
      setList(rows);
      const target = keepId ?? selected?.id ?? focusId;
      const next = rows.find((r) => r.id === target) ?? rows[0] ?? null;
      setSelected(next);
    },
    [query, selected?.id, focusId],
  );

  useEffect(() => {
    void load(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, focusId]);

  useEffect(() => {
    if (!selected) {
      setCourses([]);
      setMinutes([]);
      return;
    }
    void (async () => {
      const [allCourses, related] = await Promise.all([
        api.courses.list({}),
        api.minutes.byTrainer(selected.id),
      ]);
      setCourses(allCourses.filter((c) => c.trainer_id === selected.id));
      setMinutes(related);
    })();
  }, [selected]);

  const save = async () => {
    if (!editor?.name?.trim()) {
      toast("اسم المدرب مطلوب", "danger");
      return;
    }
    const saved = await api.trainers.save(editor);
    setEditor(null);
    toast("تم حفظ بيانات المدرب", "ok");
    await load(saved.id);
  };

  const remove = async (trainer: Trainer) => {
    const ok = await confirm(
      `حذف المدرب «${trainer.name}»؟`,
      "سيتم فك ارتباطه بالدورات المسندة إليه دون حذف الدورات.",
    );
    if (!ok) return;
    await api.trainers.remove(trainer.id);
    toast("تم حذف المدرب", "ok");
    setSelected(null);
    await load();
  };

  const availabilitySummary = useMemo(() => {
    if (!selected?.availability?.length) return "لم تُسجّل أوقات فراغ";
    const byDay = new Map<number, string[]>();
    for (const slot of selected.availability) {
      const arr = byDay.get(slot.weekday) ?? [];
      arr.push(`${minutesToLabel(slot.start_min)} – ${minutesToLabel(slot.end_min)}`);
      byDay.set(slot.weekday, arr);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, slots]) => `${WEEKDAY_NAMES[day]}: ${slots.join("، ")}`)
      .join(" · ");
  }, [selected]);

  return (
    <div>
      <PageHeader
        title="سجل المدربين"
        subtitle="ملف لكل مدرب: التخصص اللغوي، أوقات الفراغ، والمناهج التي يدرّسها"
        actions={
          <Button variant="primary" onClick={() => setEditor({ ...EMPTY, availability: [] })}>
            + مدرب جديد
          </Button>
        }
      />

      <Toolbar>
        <Input
          placeholder="بحث بالاسم أو اللغة أو المنهج…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {list.length} مدرب
        </span>
      </Toolbar>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(320px, 1.1fr) minmax(360px, 1.4fr)" }}>
        <Panel padded={false}>
          <div className="scroll-y" style={{ maxHeight: "calc(100vh - 260px)" }}>
            {list.length === 0 ? (
              <EmptyState title="لا يوجد مدربون" hint="ابدأ بإضافة أول مدرب في السجل" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>اللغات</th>
                    <th>الدورات</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t)}
                      style={{
                        cursor: "pointer",
                        background:
                          selected?.id === t.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
                      }}
                    >
                      <td className="font-semibold">{t.name}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {t.languages.map((l) => (
                            <Badge key={l}>{LANGUAGE_LABELS[l]}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="tabular-nums">{t.course_count ?? 0}</td>
                      <td>
                        {t.status === "active" ? <Badge tone="ok">نشط</Badge> : <Badge>موقوف</Badge>}
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
              <EmptyState title="اختر مدربًا لعرض ملفه" />
            </Panel>
          ) : (
            <>
              <Panel>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {selected.employment_type ?? "—"} · {selected.phone ?? "بدون رقم"}
                      {selected.email ? ` · ${selected.email}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditor({ ...selected, availability: selected.availability ?? [] })
                      }
                    >
                      تعديل
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(selected)}>
                      حذف
                    </Button>
                  </div>
                </div>

                <div className="flex gap-1 flex-wrap mb-3">
                  {selected.languages.map((l) => (
                    <Badge key={l} tone="accent">
                      {LANGUAGE_LABELS[l]}
                    </Badge>
                  ))}
                </div>

                <dl className="grid gap-3" style={{ gridTemplateColumns: "1fr" }}>
                  <div>
                    <dt className="field-label">أوقات الفراغ</dt>
                    <dd className="text-sm" style={{ color: "var(--ink-2)" }}>
                      {availabilitySummary}
                    </dd>
                  </div>
                  <div>
                    <dt className="field-label">المناهج التي يدرّسها</dt>
                    <dd className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
                      {selected.curricula || "—"}
                    </dd>
                  </div>
                  {selected.notes && (
                    <div>
                      <dt className="field-label">ملاحظات</dt>
                      <dd className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
                        {selected.notes}
                      </dd>
                    </div>
                  )}
                </dl>
              </Panel>

              <Panel>
                <h3 className="font-bold text-sm mb-2">دوراته ({courses.length})</h3>
                {courses.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    لا توجد دورات مسندة لهذا المدرب.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {courses.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                        <button className="link text-start truncate" onClick={() => onNavigate("courses", c.id)}>
                          {c.code} — {c.title}
                        </button>
                        <Badge>{c.room_name ?? "بدون قاعة"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">المحاضر والمراسلات المرتبطة ({minutes.length})</h3>
                  <Button size="sm" onClick={() => onNavigate("minutes", undefined, String(selected.id))}>
                    فتح الأرشيف
                  </Button>
                </div>
                {minutes.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    لا توجد محاضر مرتبطة بهذا المدرب.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {minutes.slice(0, 6).map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <button className="link text-start truncate" onClick={() => onNavigate("minutes", m.id)}>
                          {m.title}
                        </button>
                        <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--muted)" }}>
                          {m.meeting_date}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>

      <TrainerEditor
        value={editor}
        onChange={setEditor}
        onClose={() => setEditor(null)}
        onSave={() => void save()}
      />
    </div>
  );
}

function TrainerEditor({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: (Partial<Trainer> & { availability: Availability[] }) | null;
  onChange: (v: Partial<Trainer> & { availability: Availability[] }) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!value) return null;
  const set = (patch: Partial<Trainer> & { availability?: Availability[] }) =>
    onChange({ ...value, ...patch });

  const toggleLanguage = (lang: Language) => {
    const current = value.languages ?? [];
    set({
      languages: current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang],
    });
  };

  const addSlot = () =>
    set({
      availability: [
        ...value.availability,
        { id: -Date.now(), trainer_id: value.id ?? 0, weekday: 0, start_min: 8 * 60, end_min: 12 * 60, note: null },
      ],
    });

  const updateSlot = (index: number, patch: Partial<Availability>) =>
    set({ availability: value.availability.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  return (
    <Modal
      open
      title={value.id ? "تعديل بيانات المدرب" : "مدرب جديد"}
      onClose={onClose}
      width={780}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={onSave}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="اسم المدرب *">
          <Input value={value.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="نوع التعاقد">
          <Select
            value={value.employment_type ?? "متفرغ"}
            onChange={(e) => set({ employment_type: e.target.value })}
          >
            <option>متفرغ</option>
            <option>متعاون</option>
            <option>زائر</option>
            <option>متطوع</option>
          </Select>
        </Field>
        <Field label="رقم الجوال">
          <Input value={value.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input value={value.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3">
        <span className="field-label">التخصص اللغوي</span>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((lang) => {
            const on = (value.languages ?? []).includes(lang);
            return (
              <button
                key={lang}
                onClick={() => toggleLanguage(lang)}
                className="badge"
                style={{
                  cursor: "pointer",
                  background: on ? "var(--accent-soft)" : "var(--panel-2)",
                  color: on ? "var(--accent)" : "var(--ink-2)",
                  borderColor: on ? "var(--accent)" : "var(--border)",
                }}
              >
                {on ? "✓ " : ""}
                {LANGUAGE_LABELS[lang]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="field-label m-0">أوقات الفراغ الأسبوعية</span>
          <Button size="sm" onClick={addSlot}>
            + إضافة فترة
          </Button>
        </div>
        {value.availability.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            بدون فترات مسجّلة — لن يتحقق النظام من توافق مواعيد الدورات مع فراغه.
          </p>
        ) : (
          <div className="space-y-2">
            {value.availability.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={slot.weekday}
                  onChange={(e) => updateSlot(i, { weekday: Number(e.target.value) })}
                  style={{ maxWidth: 130 }}
                >
                  {WEEKDAY_NAMES.map((d, idx) => (
                    <option key={d} value={idx}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Input
                  type="time"
                  value={minutesToTimeInput(slot.start_min)}
                  onChange={(e) => updateSlot(i, { start_min: timeInputToMinutes(e.target.value) })}
                  style={{ maxWidth: 130 }}
                />
                <Input
                  type="time"
                  value={minutesToTimeInput(slot.end_min)}
                  onChange={(e) => updateSlot(i, { end_min: timeInputToMinutes(e.target.value) })}
                  style={{ maxWidth: 130 }}
                />
                <Input
                  placeholder="ملاحظة"
                  value={slot.note ?? ""}
                  onChange={(e) => updateSlot(i, { note: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => set({ availability: value.availability.filter((_, idx) => idx !== i) })}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="المناهج التي يدرّسها">
          <Textarea value={value.curricula ?? ""} onChange={(e) => set({ curricula: e.target.value })} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      <Field label="الحالة" className="mt-3">
        <Select
          value={value.status ?? "active"}
          onChange={(e) => set({ status: e.target.value as Trainer["status"] })}
        >
          <option value="active">نشط</option>
          <option value="inactive">موقوف</option>
        </Select>
      </Field>
    </Modal>
  );
}
