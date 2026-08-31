import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, EmptyState, PageHeader, Panel, Stat } from "../components/ui";
import { BarList, Meter, SegmentedBar } from "../components/Charts";
import { formatDate, formatDateTime } from "@shared/text";
import type { Conflict, DashboardStats } from "@shared/types";
import type { PageId } from "../App";

export default function DashboardPage({ onNavigate }: { onNavigate: (page: PageId, id?: number) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activity, setActivity] = useState<{ id: number; at: string; action: string; detail: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const [s, c, a] = await Promise.all([
        api.dashboard.stats(),
        api.conflicts.all(),
        api.dashboard.activity(),
      ]);
      setStats(s);
      setConflicts(c);
      setActivity(a);
    })();
  }, []);

  if (!stats) return <p style={{ color: "var(--muted)" }}>جارٍ التحميل…</p>;

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  return (
    <div>
      <PageHeader
        title="لوحة المؤشرات"
        subtitle="نظرة سريعة على الدورات والمدربين والقاعات وحالة التعارضات"
        actions={
          <>
            <Button onClick={() => onNavigate("courses")}>إضافة دورة</Button>
            <Button variant="primary" onClick={() => onNavigate("reports")}>
              إصدار تقرير
            </Button>
          </>
        }
      />

      {errors.length > 0 && (
        <Panel
          className="mb-4"
          padded
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold mb-1" style={{ color: "var(--danger)" }}>
                ⚠ يوجد {errors.length} تعارض يحتاج معالجة
              </h3>
              <ul className="text-sm space-y-1" style={{ color: "var(--ink-2)" }}>
                {errors.slice(0, 3).map((c) => (
                  <li key={c.id}>• {c.message}</li>
                ))}
              </ul>
            </div>
            <Button onClick={() => onNavigate("schedule")}>عرض كاشف التعارض</Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Stat label="الدورات الجارية" value={stats.activeCourses} hint={`${stats.plannedCourses} دورة مخطّطة`} />
        <Stat label="المدربون النشطون" value={stats.activeTrainers} hint={`من أصل ${stats.trainers}`} />
        <Stat label="الطلبة المسجلون" value={stats.students} hint={`${stats.enrollments} تسجيل`} />
        <Stat label="القاعات" value={stats.rooms} hint={`${stats.bookingsThisWeek} حجز هذا الأسبوع`} />
        <Stat label="الجهات الشريكة" value={stats.partners} />
        <Stat
          label="التعارضات"
          value={errors.length}
          tone={errors.length ? "danger" : "ok"}
          hint={`${warnings.length} تنبيه`}
        />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <BarList
          title="الدورات حسب اللغة"
          hint="الدورات الجارية والمخطّطة"
          data={stats.byLanguage.map((r) => ({ label: r.label, value: r.count }))}
        />
        <BarList
          title="الطلبة حسب المستوى"
          hint="عدد التسجيلات في كل مستوى"
          data={stats.byLevel.map((r) => ({ label: r.label, value: r.count }))}
        />
        <SegmentedBar title="حالة الدورات" data={stats.byStatus.map((r) => ({ label: r.label, value: r.count }))} />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Meter
          label="متوسط نسبة الحضور"
          value={stats.attendanceRate}
          hint="محسوبة من كل سجلات الحضور المدخلة أو المستوردة"
        />
        <BarList
          title="إشغال القاعات"
          hint="مجموع الساعات الأسبوعية لكل قاعة"
          data={stats.roomUtilisation.map((r) => ({ label: r.room, value: r.hours }))}
          unit=" س"
        />
        <Panel className="h-full">
          <h3 className="font-bold text-sm mb-3">القادم خلال أسبوع</h3>
          {stats.upcoming.length === 0 ? (
            <EmptyState title="لا توجد مواعيد قريبة" />
          ) : (
            <ul className="space-y-2">
              {stats.upcoming.map((u) => (
                <li key={`${u.kind}-${u.id}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" style={{ color: "var(--ink-2)" }}>
                    {u.title}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge>{u.kind}</Badge>
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {formatDate(u.date)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <h3 className="font-bold text-sm mb-3">آخر العمليات</h3>
        {activity.length === 0 ? (
          <EmptyState title="لا توجد عمليات مسجّلة بعد" />
        ) : (
          <ul className="space-y-1.5">
            {activity.slice(0, 12).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  <span style={{ color: "var(--ink-2)" }}>{a.action}</span>
                  {a.detail && <span style={{ color: "var(--muted)" }}> — {a.detail}</span>}
                </span>
                <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                  {formatDateTime(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
