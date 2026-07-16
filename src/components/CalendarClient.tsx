"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Modal, Field, Input, Select, Textarea } from "@/components/ui";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, EVENT_TYPES, RECURRENCE_TYPES, RECURRENCE_LABELS, type EventType } from "@/lib/constants";

type Item = { id: string; title: string; date: string; type: string; completed: boolean; source: "event" | "salary" };

const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function CalendarClient() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<Item[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for an in-flight fetch triggered by month change
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, [year, month]);

  const itemsByDay = useMemo(() => {
    const map: Record<number, Item[]> = {};
    for (const item of items) {
      const d = new Date(item.date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(item);
    }
    return map;
  }, [items]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedItems = itemsByDay[selectedDay] ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="secondary" onClick={prevMonth}>‹ السابق</Button>
          <div className="font-bold">{MONTH_NAMES[month]} {year}</div>
          <Button variant="secondary" onClick={nextMonth}>التالي ›</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />;
            const dayItems = itemsByDay[day] ?? [];
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={`flex min-h-[64px] flex-col items-start gap-0.5 rounded-lg border p-1 text-right text-xs ${
                  isSelected ? "border-[var(--primary)]" : "border-[var(--border)]"
                } ${isToday ? "bg-[var(--surface-muted)]" : ""}`}
              >
                <span className={`font-medium ${isToday ? "text-[var(--primary)]" : ""}`}>{day}</span>
                <div className="flex flex-wrap gap-0.5">
                  {dayItems.slice(0, 4).map((it) => (
                    <span
                      key={it.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[it.type as EventType] ?? "#64748b" }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">
            {selectedDay} {MONTH_NAMES[month]}
          </h2>
          <Button onClick={() => setShowAdd(true)}>+ إضافة</Button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد أحداث في هذا اليوم</p>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: EVENT_TYPE_COLORS[it.type as EventType] ?? "#64748b" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{it.title}</div>
                  <div className="text-xs text-gray-400">{EVENT_TYPE_LABELS[it.type as EventType] ?? it.type}</div>
                </div>
                {it.completed && <span className="text-green-600">✓</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddEventModal
        key={`${year}-${month}-${selectedDay}`}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        defaultDate={new Date(year, month, selectedDay)}
        onSaved={() => {
          const from = new Date(year, month, 1).toISOString();
          const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
          fetch(`/api/calendar?from=${from}&to=${to}`).then((r) => r.json()).then(setItems);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddEventModal({
  open,
  onClose,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate.toISOString().slice(0, 10));
  const [type, setType] = useState<string>("OTHER");
  const [recurrence, setRecurrence] = useState<string>("NONE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title) return;
    setSaving(true);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, type, recurrence, notes }),
      });
      setTitle(""); setNotes("");
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة حدث جديد">
      <div className="space-y-4">
        <Field label="العنوان">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="التاريخ">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="النوع">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="التكرار">
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCE_TYPES.map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
            ))}
          </Select>
        </Field>
        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </div>
    </Modal>
  );
}
