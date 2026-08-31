import { useCallback, useEffect, useState } from "react";
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
import { formatDate, todayISO } from "@shared/text";
import type { MeetingMinute, Trainer } from "@shared/types";

type Draft = Partial<MeetingMinute> & { trainer_ids: number[] };

const emptyDraft = (): Draft => ({
  meeting_date: todayISO(),
  title: "",
  location: "",
  parties: "",
  attendees: "",
  agenda: "",
  decisions: "",
  curriculum_notes: "",
  follow_up: "",
  tags: "",
  trainer_ids: [],
});

export default function MinutesPage({ focusId, trainerId }: { focusId?: number; trainerId?: number }) {
  const { toast, confirm } = useUi();
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [query, setQuery] = useState("");
  const [filterTrainer, setFilterTrainer] = useState<number | "">(trainerId ?? "");
  const [range, setRange] = useState({ from: "", to: "" });
  const [selected, setSelected] = useState<MeetingMinute | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(
    async (keepId?: number) => {
      const rows = await api.minutes.list({
        query: query.trim() || undefined,
        trainerId: filterTrainer ? Number(filterTrainer) : undefined,
        from: range.from || undefined,
        to: range.to || undefined,
      });
      setMinutes(rows);
      const target = keepId ?? selected?.id ?? focusId;
      setSelected(rows.find((r) => r.id === target) ?? rows[0] ?? null);
    },
    [query, filterTrainer, range.from, range.to, selected?.id, focusId],
  );

  useEffect(() => {
    void load(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterTrainer, range.from, range.to, focusId]);

  useEffect(() => {
    void api.trainers.list().then(setTrainers);
  }, []);

  useEffect(() => {
    if (trainerId) setFilterTrainer(trainerId);
  }, [trainerId]);

  const save = async () => {
    if (!draft?.title?.trim()) {
      toast("عنوان المحضر مطلوب", "danger");
      return;
    }
    const saved = await api.minutes.save(draft);
    setDraft(null);
    toast("تم حفظ المحضر", "ok");
    await load(saved.id);
  };

  const attach = async () => {
    if (!selected) return;
    const picked = await api.files.pick();
    if (!picked) return;
    await api.minutes.attach(selected.id, picked);
    toast("تمت إضافة المرفق", "ok");
    const fresh = await api.minutes.get(selected.id);
    if (fresh) setSelected(fresh);
  };

  return (
    <div>
      <PageHeader
        title="أرشيف محاضر الاجتماعات وتصميم المناهج"
        subtitle="سجّل ما اتُّفق عليه مع كل مدرب، واسترجعه بالبحث الفوري في أي وقت"
        actions={
          <Button variant="primary" onClick={() => setDraft(emptyDraft())}>
            + محضر جديد
          </Button>
        }
      />

      <Toolbar>
        <Input
          placeholder="بحث فوري في العناوين والقرارات وملاحظات المناهج…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 380 }}
        />
        <Select
          value={filterTrainer}
          onChange={(e) => setFilterTrainer(e.target.value ? Number(e.target.value) : "")}
          style={{ maxWidth: 220 }}
        >
          <option value="">كل المدربين</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={range.from}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
          style={{ maxWidth: 165 }}
        />
        <Input
          type="date"
          value={range.to}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
          style={{ maxWidth: 165 }}
        />
        <span className="text-sm pb-2" style={{ color: "var(--muted)" }}>
          {minutes.length} محضر
        </span>
      </Toolbar>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.4fr)" }}>
        <Panel padded={false}>
          <div className="scroll-y" style={{ maxHeight: "calc(100vh - 270px)" }}>
            {minutes.length === 0 ? (
              <EmptyState title="لا توجد محاضر مطابقة" hint="جرّب كلمة بحث أخرى أو أنشئ محضرًا جديدًا" />
            ) : (
              <ul>
                {minutes.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setSelected(m)}
                      className="w-full text-start px-4 py-3"
                      style={{
                        background:
                          selected?.id === m.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{m.title}</span>
                        <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--muted)" }}>
                          {formatDate(m.meeting_date)}
                        </span>
                      </div>
                      <div className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
                        {m.parties || "بدون أطراف مسجّلة"}
                      </div>
                      {(m.trainer_names ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {(m.trainer_names ?? []).map((n) => (
                            <Badge key={n}>{n}</Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          {!selected ? (
            <EmptyState title="اختر محضرًا لعرضه" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{selected.title}</h2>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {formatDate(selected.meeting_date)} · {selected.location || "بدون مكان محدد"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={attach}>
                    + مرفق
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDraft({ ...selected, trainer_ids: selected.trainer_ids ?? [] })}
                  >
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!(await confirm(`حذف المحضر «${selected.title}»؟`))) return;
                      await api.minutes.remove(selected.id);
                      setSelected(null);
                      toast("تم حذف المحضر", "ok");
                      await load();
                    }}
                  >
                    حذف
                  </Button>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap mb-4">
                {(selected.trainer_names ?? []).map((n) => (
                  <Badge key={n} tone="accent">
                    {n}
                  </Badge>
                ))}
                {(selected.tags ?? "")
                  .split("،")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
              </div>

              <Section title="الأطراف" body={selected.parties} />
              <Section title="الحضور" body={selected.attendees} />
              <Section title="جدول الأعمال" body={selected.agenda} />
              <Section title="النقاط المتفق عليها" body={selected.decisions} />
              <Section title="ملاحظات تصميم المنهج" body={selected.curriculum_notes} />
              <Section title="المتابعة" body={selected.follow_up} />

              {(selected.files ?? []).length > 0 && (
                <div className="mt-3">
                  <span className="field-label">المرفقات</span>
                  <ul className="space-y-1">
                    {(selected.files ?? []).map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                        <button className="link truncate" onClick={() => void api.files.open(f.file_path)}>
                          {f.title}
                        </button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            await api.minutes.detach(f.id);
                            const fresh = await api.minutes.get(selected.id);
                            if (fresh) setSelected(fresh);
                          }}
                        >
                          ✕
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={!!draft}
        title={draft?.id ? "تعديل المحضر" : "نموذج المحضر السريع"}
        onClose={() => setDraft(null)}
        width={840}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void save()}>
              حفظ
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <Field label="تاريخ الاجتماع">
                <Input
                  type="date"
                  value={draft.meeting_date ?? ""}
                  onChange={(e) => setDraft({ ...draft, meeting_date: e.target.value })}
                />
              </Field>
              <Field label="العنوان *" className="col-span-2">
                <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </Field>
              <Field label="المكان">
                <Input
                  value={draft.location ?? ""}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </Field>
              <Field label="الأطراف" className="col-span-2">
                <Input
                  value={draft.parties ?? ""}
                  onChange={(e) => setDraft({ ...draft, parties: e.target.value })}
                  placeholder="إدارة البرامج، معهد الأفق، أ. سامي…"
                />
              </Field>
            </div>

            <div className="mt-3">
              <span className="field-label">ربط بمدربين</span>
              <div className="flex gap-2 flex-wrap">
                {trainers.map((t) => {
                  const on = draft.trainer_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          trainer_ids: on
                            ? draft.trainer_ids.filter((id) => id !== t.id)
                            : [...draft.trainer_ids, t.id],
                        })
                      }
                      className="badge"
                      style={{
                        cursor: "pointer",
                        background: on ? "var(--accent-soft)" : "var(--panel-2)",
                        color: on ? "var(--accent)" : "var(--ink-2)",
                        borderColor: on ? "var(--accent)" : "var(--border)",
                      }}
                    >
                      {on ? "✓ " : ""}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="الحضور">
                <Input
                  value={draft.attendees ?? ""}
                  onChange={(e) => setDraft({ ...draft, attendees: e.target.value })}
                />
              </Field>
              <Field label="وسوم">
                <Input
                  value={draft.tags ?? ""}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  placeholder="تصميم مناهج، توزيع مستويات"
                />
              </Field>
              <Field label="جدول الأعمال" className="col-span-2">
                <Textarea value={draft.agenda ?? ""} onChange={(e) => setDraft({ ...draft, agenda: e.target.value })} />
              </Field>
              <Field label="النقاط المتفق عليها" className="col-span-2">
                <Textarea
                  value={draft.decisions ?? ""}
                  onChange={(e) => setDraft({ ...draft, decisions: e.target.value })}
                />
              </Field>
              <Field label="ملاحظات تصميم المنهج">
                <Textarea
                  value={draft.curriculum_notes ?? ""}
                  onChange={(e) => setDraft({ ...draft, curriculum_notes: e.target.value })}
                />
              </Field>
              <Field label="المتابعة">
                <Textarea
                  value={draft.follow_up ?? ""}
                  onChange={(e) => setDraft({ ...draft, follow_up: e.target.value })}
                />
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div className="mb-3">
      <span className="field-label">{title}</span>
      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ink-2)", lineHeight: 1.8 }}>
        {body}
      </p>
    </div>
  );
}
