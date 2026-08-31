import { useCallback, useEffect, useState } from "react";
import { api, type RoomDayView } from "../lib/api";
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
import { BOOKING_KIND_LABELS, BOOKING_STATUS_LABELS, ROOM_STATUS_LABELS } from "@shared/labels";
import {
  WEEKDAY_NAMES,
  formatDate,
  minutesToLabel,
  minutesToTimeInput,
  timeInputToMinutes,
  todayISO,
} from "@shared/text";
import type { Booking, Conflict, Partner, Room } from "@shared/types";

type BookingDraft = Partial<Booking>;

const emptyBooking = (roomId?: number): BookingDraft => ({
  room_id: roomId,
  title: "",
  kind: "external",
  partner_id: null,
  date: todayISO(),
  start_min: 9 * 60,
  end_min: 12 * 60,
  status: "pending",
  contact: "",
  purpose: "",
  notes: "",
});

export default function RoomsPage({ focusId }: { focusId?: number }) {
  const { toast, confirm } = useUi();
  const [tab, setTab] = useState("day");
  const [date, setDate] = useState(todayISO());
  const [dayView, setDayView] = useState<RoomDayView | null>(null);
  const [rooms, setRooms] = useState<(Room & { course_count?: number })[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [range, setRange] = useState({ from: todayISO(), to: "" });
  const [roomDraft, setRoomDraft] = useState<Partial<Room> | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const loadAll = useCallback(async () => {
    const [dv, rs, ps, bs] = await Promise.all([
      api.rooms.dayView(date),
      api.rooms.list(),
      api.partners.list(),
      api.bookings.list({ from: range.from || undefined, to: range.to || undefined }),
    ]);
    setDayView(dv);
    setRooms(rs);
    setPartners(ps);
    setBookings(bs);
  }, [date, range.from, range.to]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (focusId) setTab("rooms");
  }, [focusId]);

  useEffect(() => {
    if (!bookingDraft?.room_id || !bookingDraft.date) {
      setConflicts([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setConflicts(
        await api.conflicts.booking({
          bookingId: bookingDraft.id ?? null,
          roomId: bookingDraft.room_id as number,
          date: bookingDraft.date as string,
          startMin: bookingDraft.start_min ?? 0,
          endMin: bookingDraft.end_min ?? 0,
          label: bookingDraft.title || "حجز جديد",
        }),
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [bookingDraft]);

  const saveRoom = async () => {
    if (!roomDraft?.name?.trim()) {
      toast("اسم القاعة مطلوب", "danger");
      return;
    }
    await api.rooms.save(roomDraft);
    setRoomDraft(null);
    toast("تم حفظ القاعة", "ok");
    await loadAll();
  };

  const saveBooking = async () => {
    if (!bookingDraft?.title?.trim() || !bookingDraft.room_id) {
      toast("عنوان الحجز والقاعة مطلوبان", "danger");
      return;
    }
    if ((bookingDraft.end_min ?? 0) <= (bookingDraft.start_min ?? 0)) {
      toast("وقت النهاية يجب أن يكون بعد وقت البداية", "danger");
      return;
    }
    const res = await api.bookings.save(bookingDraft);
    setBookingDraft(null);
    toast(
      res.conflicts.some((c) => c.severity === "error")
        ? "تم الحفظ مع وجود تعارض في القاعة"
        : "تم حفظ الحجز",
      res.conflicts.some((c) => c.severity === "error") ? "danger" : "ok",
    );
    await loadAll();
  };

  return (
    <div>
      <PageHeader
        title="مدير القاعات والمرافق"
        subtitle="اعرف أي قاعة مشغولة وأيها فاضية، وسجّل طلبات الاستئجار للجهات الخارجية"
        actions={
          <>
            <Button onClick={() => setRoomDraft({ name: "", capacity: 20, status: "available" })}>+ قاعة</Button>
            <Button variant="primary" onClick={() => setBookingDraft(emptyBooking(rooms[0]?.id))}>
              + حجز جديد
            </Button>
          </>
        }
      />

      <TabBar
        tabs={[
          { id: "day", label: "إشغال اليوم" },
          { id: "bookings", label: "الحجوزات", count: bookings.length },
          { id: "rooms", label: "القاعات", count: rooms.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "day" && (
        <>
          <Toolbar>
            <Field label="التاريخ">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 190 }} />
            </Field>
            <span className="text-sm pb-2" style={{ color: "var(--muted)" }}>
              {dayView ? WEEKDAY_NAMES[dayView.weekday] : ""} — {formatDate(date)}
            </span>
          </Toolbar>

          <Panel padded={false}>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>القاعة</th>
                  <th>الإشغال</th>
                  <th style={{ width: 120 }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(dayView?.rooms ?? []).map((room) => {
                  const courses = (dayView?.courses ?? []).filter((c) => c.room_id === room.id);
                  const roomBookings = (dayView?.bookings ?? []).filter((b) => b.room_id === room.id);
                  const busy = courses.length + roomBookings.length > 0;
                  return (
                    <tr key={room.id}>
                      <td>
                        <div className="font-semibold">{room.name}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          {room.building ?? "—"} · سعة {room.capacity}
                        </div>
                      </td>
                      <td>
                        {!busy ? (
                          <Badge tone="ok">فاضية طوال اليوم</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {courses.map((c) => (
                              <span key={`c-${c.course_id}`} className="badge badge-accent">
                                {c.code} · {minutesToLabel(c.start_min)}–{minutesToLabel(c.end_min)}
                              </span>
                            ))}
                            {roomBookings.map((b) => (
                              <span
                                key={`b-${b.id}`}
                                className={`badge ${b.status === "pending" ? "badge-warn" : ""}`}
                                title={b.purpose ?? ""}
                              >
                                {b.title} · {minutesToLabel(b.start_min)}–{minutesToLabel(b.end_min)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tone={room.status === "available" ? "ok" : "warn"}>
                          {ROOM_STATUS_LABELS[room.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {tab === "bookings" && (
        <>
          <Toolbar>
            <Field label="من تاريخ">
              <Input
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
                style={{ maxWidth: 180 }}
              />
            </Field>
            <Field label="إلى تاريخ">
              <Input
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
                style={{ maxWidth: 180 }}
              />
            </Field>
          </Toolbar>
          <Panel padded={false}>
            {bookings.length === 0 ? (
              <EmptyState title="لا توجد حجوزات في هذه الفترة" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الوقت</th>
                    <th>القاعة</th>
                    <th>الغرض</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="tabular-nums">{formatDate(b.date)}</td>
                      <td className="tabular-nums text-sm">
                        {minutesToLabel(b.start_min)} – {minutesToLabel(b.end_min)}
                      </td>
                      <td>{b.room_name}</td>
                      <td>
                        <div className="font-semibold">{b.title}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          {b.partner_name ?? b.purpose ?? "—"}
                        </div>
                      </td>
                      <td>
                        <Badge>{BOOKING_KIND_LABELS[b.kind]}</Badge>
                      </td>
                      <td>
                        <Badge
                          tone={b.status === "confirmed" ? "ok" : b.status === "cancelled" ? "danger" : "warn"}
                        >
                          {BOOKING_STATUS_LABELS[b.status]}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setBookingDraft(b)}>
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              if (!(await confirm(`حذف الحجز «${b.title}»؟`))) return;
                              await api.bookings.remove(b.id);
                              toast("تم حذف الحجز", "ok");
                              await loadAll();
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

      {tab === "rooms" && (
        <Panel padded={false}>
          <table className="data">
            <thead>
              <tr>
                <th>القاعة</th>
                <th>المبنى</th>
                <th>السعة</th>
                <th>التجهيزات</th>
                <th>الدورات</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} style={{ background: focusId === r.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined }}>
                  <td className="font-semibold">{r.name}</td>
                  <td>{r.building ?? "—"}</td>
                  <td className="tabular-nums">{r.capacity}</td>
                  <td className="text-sm" style={{ color: "var(--ink-2)" }}>
                    {r.features ?? "—"}
                  </td>
                  <td className="tabular-nums">{r.course_count ?? 0}</td>
                  <td>
                    <Badge tone={r.status === "available" ? "ok" : "warn"}>{ROOM_STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => setRoomDraft(r)}>
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          if (!(await confirm(`حذف القاعة «${r.name}»؟`, "ستُحذف حجوزاتها أيضًا."))) return;
                          await api.rooms.remove(r.id);
                          toast("تم حذف القاعة", "ok");
                          await loadAll();
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
        </Panel>
      )}

      <Modal
        open={!!roomDraft}
        title={roomDraft?.id ? "تعديل قاعة" : "قاعة جديدة"}
        onClose={() => setRoomDraft(null)}
        footer={
          <>
            <Button onClick={() => setRoomDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void saveRoom()}>
              حفظ
            </Button>
          </>
        }
      >
        {roomDraft && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="اسم القاعة *">
              <Input value={roomDraft.name ?? ""} onChange={(e) => setRoomDraft({ ...roomDraft, name: e.target.value })} />
            </Field>
            <Field label="المبنى">
              <Input
                value={roomDraft.building ?? ""}
                onChange={(e) => setRoomDraft({ ...roomDraft, building: e.target.value })}
              />
            </Field>
            <Field label="السعة">
              <Input
                type="number"
                min={0}
                value={roomDraft.capacity ?? 0}
                onChange={(e) => setRoomDraft({ ...roomDraft, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label="الحالة">
              <Select
                value={roomDraft.status ?? "available"}
                onChange={(e) => setRoomDraft({ ...roomDraft, status: e.target.value as Room["status"] })}
              >
                {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="التجهيزات" className="col-span-2">
              <Input
                value={roomDraft.features ?? ""}
                onChange={(e) => setRoomDraft({ ...roomDraft, features: e.target.value })}
                placeholder="بروجكتر، سبورة ذكية، نظام صوتي…"
              />
            </Field>
            <Field label="ملاحظات" className="col-span-2">
              <Textarea
                value={roomDraft.notes ?? ""}
                onChange={(e) => setRoomDraft({ ...roomDraft, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!bookingDraft}
        title={bookingDraft?.id ? "تعديل حجز" : "حجز قاعة / طلب استئجار"}
        onClose={() => setBookingDraft(null)}
        width={760}
        footer={
          <>
            <Button onClick={() => setBookingDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void saveBooking()}>
              حفظ
            </Button>
          </>
        }
      >
        {bookingDraft && (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <Field label="عنوان الحجز *" className="col-span-2">
                <Input
                  value={bookingDraft.title ?? ""}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, title: e.target.value })}
                  placeholder="ورشة تدريبية — جهة خارجية"
                />
              </Field>
              <Field label="النوع">
                <Select
                  value={bookingDraft.kind}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, kind: e.target.value as Booking["kind"] })}
                >
                  {Object.entries(BOOKING_KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="القاعة *">
                <Select
                  value={bookingDraft.room_id ?? ""}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, room_id: Number(e.target.value) })}
                >
                  <option value="">— اختر قاعة —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.capacity})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="التاريخ">
                <Input
                  type="date"
                  value={bookingDraft.date ?? ""}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, date: e.target.value })}
                />
              </Field>
              <Field label="الحالة">
                <Select
                  value={bookingDraft.status}
                  onChange={(e) =>
                    setBookingDraft({ ...bookingDraft, status: e.target.value as Booking["status"] })
                  }
                >
                  {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="من الساعة">
                <Input
                  type="time"
                  value={minutesToTimeInput(bookingDraft.start_min ?? 0)}
                  onChange={(e) =>
                    setBookingDraft({ ...bookingDraft, start_min: timeInputToMinutes(e.target.value) })
                  }
                />
              </Field>
              <Field label="إلى الساعة">
                <Input
                  type="time"
                  value={minutesToTimeInput(bookingDraft.end_min ?? 0)}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, end_min: timeInputToMinutes(e.target.value) })}
                />
              </Field>
              <Field label="الجهة الخارجية">
                <Select
                  value={bookingDraft.partner_id ?? ""}
                  onChange={(e) =>
                    setBookingDraft({
                      ...bookingDraft,
                      partner_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">— بدون —</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="جهة الاتصال" className="col-span-2">
                <Input
                  value={bookingDraft.contact ?? ""}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, contact: e.target.value })}
                />
              </Field>
              <Field label="الغرض" className="col-span-3">
                <Textarea
                  value={bookingDraft.purpose ?? ""}
                  onChange={(e) => setBookingDraft({ ...bookingDraft, purpose: e.target.value })}
                />
              </Field>
            </div>

            {conflicts.length > 0 && (
              <div
                className="mt-3 p-3 rounded-xl"
                style={{
                  background: conflicts.some((c) => c.severity === "error") ? "var(--danger-soft)" : "var(--warn-soft)",
                  border: `1px solid ${conflicts.some((c) => c.severity === "error") ? "var(--danger)" : "var(--warn)"}`,
                }}
              >
                <ul className="text-sm space-y-1" style={{ color: "var(--ink-2)" }}>
                  {conflicts.map((c) => (
                    <li key={c.id}>⚠ {c.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
