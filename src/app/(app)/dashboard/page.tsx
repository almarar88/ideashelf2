import Link from "next/link";
import { getDefaultFarm } from "@/lib/farm";
import { prisma } from "@/lib/prisma";
import { getWeather, weatherDescription } from "@/lib/weather";
import { syncAuctionStatuses } from "@/lib/auctions";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui";
import { DashboardChartsGrid } from "@/components/DashboardCharts";
import {
  PALM_STATUSES,
  SALARY_STATUS_LABELS,
  type SalaryStatus,
} from "@/lib/constants";

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌦️", 61: "🌧️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 80: "🌦️", 95: "⛈️",
};

export default async function DashboardPage() {
  await syncAuctionStatuses();
  const farm = await getDefaultFarm();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    palmsGrouped,
    workerCount,
    monthExpenses,
    pendingSalaries,
    upcomingSalaries,
    activeAuctions,
    openDiagnoses,
    expensesByCategoryRaw,
    weather,
  ] = await Promise.all([
    prisma.palm.groupBy({ by: ["status"], where: { farmId: farm.id }, _count: true }),
    prisma.worker.count({ where: { farmId: farm.id, status: "ACTIVE" } }),
    prisma.expense.aggregate({ where: { farmId: farm.id, date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.salaryPayment.aggregate({
      where: { worker: { farmId: farm.id }, status: { not: "PAID" } },
      _sum: { amount: true },
    }),
    prisma.salaryPayment.findMany({
      where: { worker: { farmId: farm.id }, status: { not: "PAID" }, dueDate: { lte: weekAhead } },
      include: { worker: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.diagnosisReport.count({ where: { status: "OPEN" } }),
    prisma.expense.groupBy({ by: ["category"], where: { farmId: farm.id }, _sum: { amount: true } }),
    farm.lat && farm.lng ? getWeather(farm.lat, farm.lng) : Promise.resolve(null),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of PALM_STATUSES) statusCounts[s] = 0;
  for (const g of palmsGrouped) statusCounts[g.status] = g._count;
  const totalPalms = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const expensesByCategory = expensesByCategoryRaw.map((e) => ({
    category: e.category,
    total: e._sum.amount ?? 0,
  }));

  return (
    <div>
      <PageHeader title={`مرحبًا بك في ${farm.name}`} subtitle="نظرة عامة على حالة مزرعتك اليوم" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي النخيل" value={totalPalms} icon="🌴" hint={`${statusCounts.SICK} مصابة`} color="#2f6b3a" />
        <StatCard label="العمال النشطون" value={workerCount} icon="👷" color="#0ea5e9" />
        <StatCard label="مصاريف هذا الشهر" value={`${(monthExpenses._sum.amount ?? 0).toLocaleString()} ر.س`} icon="💰" color="#dc2626" />
        <StatCard label="مستحقات رواتب" value={`${(pendingSalaries._sum.amount ?? 0).toLocaleString()} ر.س`} icon="🧾" color="#f59e0b" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="text-4xl">{weather ? WEATHER_ICONS[weather.weatherCode] ?? "🌡️" : "🌡️"}</div>
          <div>
            <div className="text-xs text-gray-500">الطقس الآن ({farm.address || "موقع المزرعة"})</div>
            {weather ? (
              <>
                <div className="text-xl font-bold">{Math.round(weather.temperature)}°C</div>
                <div className="text-xs text-gray-400">
                  {weatherDescription(weather.weatherCode)} • رطوبة {weather.humidity ?? "—"}% • رياح {Math.round(weather.windSpeed)} كم/س
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400">حدد موقع المزرعة لعرض الطقس</div>
            )}
          </div>
        </Card>
        <Link href="/disease-detection">
          <Card className="flex h-full items-center gap-4 transition hover:shadow-md">
            <div className="text-4xl">🤖</div>
            <div>
              <div className="text-xs text-gray-500">تشخيصات تحتاج متابعة</div>
              <div className="text-xl font-bold">{openDiagnoses}</div>
            </div>
          </Card>
        </Link>
        <Link href="/auctions">
          <Card className="flex h-full items-center gap-4 transition hover:shadow-md">
            <div className="text-4xl">🔨</div>
            <div>
              <div className="text-xs text-gray-500">مزادات نشطة الآن</div>
              <div className="text-xl font-bold">{activeAuctions}</div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mb-6">
        <DashboardChartsGrid statusCounts={statusCounts} expensesByCategory={expensesByCategory} />
      </div>

      <Card>
        <h2 className="mb-3 font-bold">رواتب مستحقة خلال 7 أيام</h2>
        {upcomingSalaries.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد مستحقات قريبة</p>
        ) : (
          <div className="space-y-2">
            {upcomingSalaries.map((s) => (
              <Link key={s.id} href={`/workers/${s.workerId}`}>
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2 text-sm hover:bg-[var(--surface-muted)]">
                  <span>{s.worker.name} — {s.periodMonth}</span>
                  <div className="flex items-center gap-2">
                    <span>{s.amount.toLocaleString()} ر.س</span>
                    <Badge color={s.status === "LATE" ? "#dc2626" : "#f59e0b"}>
                      {SALARY_STATUS_LABELS[s.status as SalaryStatus]}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
