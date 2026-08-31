import { useEffect, useMemo, useState } from "react";
import { api, type ScheduleSession } from "../lib/api";
import { Badge, Button, EmptyState, PageHeader, Panel, Select } from "../components/ui";
import { LANGUAGE_LABELS } from "@shared/labels";
import { WEEKDAY_NAMES, minutesToLabel } from "@shared/text";
import type { Conflict } from "@shared/types";
import type { PageId } from "../App";

const DAY_START = 7 * 60;
const DAY_END = 22 * 60;
const PX_PER_MIN = 1.05;

export default function SchedulePage({ onNavigate }: { onNavigate: (page: PageId, id?: number) => void }) {
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const data = await api.schedule.week();
    setSessions(data.sessions);
    setConflicts(data.conflicts);
  };

  useEffect(() => {
    void load();
  }, []);

  const conflictedCourses = useMemo(() => {
    const ids = new Set<number>();
    for (const c of conflicts) {
      if (c.severity !== "error") continue;
      for (const ref of c.refs) if (ref.kind === "course") ids.add(ref.id);
    }
    return ids;
  }, [conflicts]);

  const warnedCourses = useMemo(() => {
    const ids = new Set<number>();
    for (const c of conflicts) {
      if (c.severity !== "warning") continue;
      for (const ref of c.refs) if (ref.kind === "course") ids.add(ref.id);
    }
    return ids;
  }, [conflicts]);

  const visible = useMemo(
    () => (filter === "all" ? sessions : sessions.filter((s) => s.language === filter)),
    [sessions, filter],
  );

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  return (
    <div>
      <PageHeader
        title="الجدول الأسبوعي وكاشف التعارض"
        subtitle="كل حصص الدورات الجارية والمخطّطة — يظهر بالأحمر أي تعارض في القاعة أو المدرب"
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="all">كل اللغات</option>
              {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Button onClick={() => void load()}>تحديث</Button>
          </>
        }
      />

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Panel>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            التعارضات الحرجة
          </div>
          <div className="text-2xl font-bold" style={{ color: errors.length ? "var(--danger)" : "var(--ok)" }}>
            {errors.length}
          </div>
        </Panel>
        <Panel>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            التنبيهات
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--warn)" }}>
            {warnings.length}
          </div>
        </Panel>
        <Panel>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            الحصص الأسبوعية
          </div>
          <div className="text-2xl font-bold">{sessions.length}</div>
        </Panel>
      </div>

      {conflicts.length > 0 && (
        <Panel className="mb-4">
          <h3 className="font-bold text-sm mb-2">قائمة التعارضات</h3>
          <ul className="space-y-2">
            {conflicts.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <Badge tone={c.severity === "error" ? "danger" : "warn"}>
                  {c.type === "room"
                    ? "قاعة"
                    : c.type === "trainer"
                      ? "مدرب"
                      : c.type === "availability"
                        ? "فراغ المدرب"
                        : "حالة القاعة"}
                </Badge>
                <span style={{ color: "var(--ink-2)" }}>{c.message}</span>
                {c.refs[0]?.kind === "course" && (
                  <button className="link text-xs shrink-0" onClick={() => onNavigate("courses", c.refs[0].id)}>
                    فتح الدورة
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel padded={false}>
        {visible.length === 0 ? (
          <EmptyState title="لا توجد حصص مجدولة" hint="أضف حصصًا أسبوعية للدورات لتظهر في الجدول" />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ display: "flex", minWidth: 900 }}>
              <div style={{ width: 62, flexShrink: 0, borderInlineEnd: "1px solid var(--border)" }}>
                <div style={{ height: 34, borderBottom: "1px solid var(--border)" }} />
                <div style={{ position: "relative", height: (DAY_END - DAY_START) * PX_PER_MIN }}>
                  {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: i * 60 * PX_PER_MIN - 7,
                        insetInlineEnd: 6,
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      {minutesToLabel(DAY_START + i * 60)}
                    </div>
                  ))}
                </div>
              </div>

              {WEEKDAY_NAMES.map((day, weekday) => (
                <div key={day} style={{ flex: 1, minWidth: 118, borderInlineEnd: "1px solid var(--border)" }}>
                  <div
                    style={{
                      height: 34,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12.5,
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border)",
                      color: "var(--ink-2)",
                    }}
                  >
                    {day}
                  </div>
                  <div style={{ position: "relative", height: (DAY_END - DAY_START) * PX_PER_MIN }}>
                    {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          top: i * 60 * PX_PER_MIN,
                          insetInline: 0,
                          height: 60 * PX_PER_MIN,
                          borderBottom: "1px solid var(--grid)",
                        }}
                      />
                    ))}
                    {visible
                      .filter((s) => s.weekday === weekday)
                      .map((s) => {
                        const bad = conflictedCourses.has(s.course_id);
                        const warn = !bad && warnedCourses.has(s.course_id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => onNavigate("courses", s.course_id)}
                            title={`${s.code} — ${s.title}\n${s.trainer_name ?? "بدون مدرب"} · ${s.room_name ?? "بدون قاعة"}\n${minutesToLabel(s.start_min)} – ${minutesToLabel(s.end_min)}`}
                            style={{
                              position: "absolute",
                              top: (s.start_min - DAY_START) * PX_PER_MIN,
                              height: Math.max(28, (s.end_min - s.start_min) * PX_PER_MIN - 3),
                              insetInline: 3,
                              borderRadius: 8,
                              padding: "4px 6px",
                              textAlign: "start",
                              cursor: "pointer",
                              overflow: "hidden",
                              background: bad
                                ? "var(--danger-soft)"
                                : warn
                                  ? "var(--warn-soft)"
                                  : "color-mix(in srgb, var(--series-2) 20%, transparent)",
                              border: `1px solid ${bad ? "var(--danger)" : warn ? "var(--warn)" : "color-mix(in srgb, var(--series-2) 60%, transparent)"}`,
                              color: "var(--ink)",
                            }}
                          >
                            <div className="text-[11.5px] font-bold truncate">
                              {bad ? "⚠ " : ""}
                              {s.code}
                            </div>
                            <div className="text-[10.5px] truncate" style={{ color: "var(--ink-2)" }}>
                              {s.room_name ?? "—"}
                            </div>
                            <div className="text-[10.5px] truncate" style={{ color: "var(--muted)" }}>
                              {s.trainer_name ?? "—"}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
