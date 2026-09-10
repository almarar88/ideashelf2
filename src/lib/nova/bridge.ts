import { prisma } from "@/lib/prisma";

/**
 * جسر نوفا إلى بيانات التطبيق الحقيقية.
 *
 * هذا ما يجعل نوفا نظامًا متكاملًا لا جزيرة: النبضة أدناه تُقرأ من قاعدة
 * البيانات نفسها التي يعمل عليها تطبيق المزرعة، وتُغذّي ثلاثة أشياء معًا:
 * تطبيق «المزرعة» داخل نوفا، وسياق طبقة العصب (فيجيب Claude عن أرقامك
 * الفعلية لا عن تخمين)، وتقارير الوكلاء.
 *
 * القراءة فقط بقصد: الكتابة في بيانات المزرعة تبقى مسؤولية شاشات التطبيق
 * التي تتحقّق من قواعد العمل. نوفا تُبصر ولا تُغيّر ما لا تملك قواعده.
 */

export type FarmPulse = {
  ok: boolean;
  farm: { name: string; address: string | null; areaHectares: number | null } | null;
  palms: { total: number; healthy: number; sick: number; treatment: number; young: number; dead: number };
  varieties: { label: string; value: number }[];
  workers: { active: number; inactive: number; payroll: number };
  money: { monthTotal: number; yearTotal: number; byCategory: { label: string; value: number }[] };
  yieldKg: number;
  events: { title: string; date: string; type: string }[];
  market: { open: number; auctions: number; topBid: number };
  health: { openDiagnoses: number; lastDisease: string | null };
  generatedAt: number;
};

const CATEGORY_AR: Record<string, string> = {
  WATER: "ماء",
  FERTILIZER: "سماد",
  PESTICIDE: "مبيدات",
  EQUIPMENT: "معدات",
  MAINTENANCE: "صيانة",
  FUEL: "وقود",
  LABOR: "عمالة",
  UTILITIES: "خدمات",
  OTHER: "أخرى",
};

export async function readFarmPulse(): Promise<FarmPulse> {
  const empty: FarmPulse = {
    ok: false,
    farm: null,
    palms: { total: 0, healthy: 0, sick: 0, treatment: 0, young: 0, dead: 0 },
    varieties: [],
    workers: { active: 0, inactive: 0, payroll: 0 },
    money: { monthTotal: 0, yearTotal: 0, byCategory: [] },
    yieldKg: 0,
    events: [],
    market: { open: 0, auctions: 0, topBid: 0 },
    health: { openDiagnoses: 0, lastDisease: null },
    generatedAt: Date.now(),
  };

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [farm, palms, workers, expenses, events, listings, auctions, diagnoses] = await Promise.all([
      prisma.farm.findFirst({ select: { name: true, address: true, areaHectares: true } }),
      prisma.palm.findMany({ select: { status: true, variety: true, lastYieldKg: true } }),
      prisma.worker.findMany({ select: { status: true, monthlySalary: true } }),
      prisma.expense.findMany({ where: { date: { gte: yearStart } }, select: { amount: true, category: true, date: true } }),
      prisma.calendarEvent.findMany({
        where: { date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: { title: true, date: true, type: true },
      }),
      prisma.marketListing.count({ where: { status: "ACTIVE" } }).catch(() => 0),
      prisma.auction.findMany({ where: { status: "OPEN" }, select: { currentPrice: true } }).catch(() => []),
      prisma.diagnosisReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { status: true, diseaseName: true },
      }),
    ]);

    const byStatus = (s: string) => palms.filter((p) => p.status === s).length;

    const varietyCounts = new Map<string, number>();
    palms.forEach((p) => varietyCounts.set(p.variety, (varietyCounts.get(p.variety) ?? 0) + 1));

    const catCounts = new Map<string, number>();
    let monthTotal = 0;
    for (const e of expenses) {
      catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + e.amount);
      if (e.date >= monthStart) monthTotal += e.amount;
    }

    return {
      ok: true,
      farm: farm ? { name: farm.name, address: farm.address, areaHectares: farm.areaHectares } : null,
      palms: {
        total: palms.length,
        healthy: byStatus("HEALTHY"),
        sick: byStatus("SICK"),
        treatment: byStatus("UNDER_TREATMENT"),
        young: byStatus("YOUNG_SEEDLING"),
        dead: byStatus("DEAD"),
      },
      varieties: [...varietyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value })),
      workers: {
        active: workers.filter((w) => w.status === "ACTIVE").length,
        inactive: workers.filter((w) => w.status !== "ACTIVE").length,
        payroll: workers.filter((w) => w.status === "ACTIVE").reduce((sum, w) => sum + w.monthlySalary, 0),
      },
      money: {
        monthTotal,
        yearTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
        byCategory: [...catCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7)
          .map(([k, value]) => ({ label: CATEGORY_AR[k] ?? k, value: Math.round(value) })),
      },
      yieldKg: Math.round(palms.reduce((sum, p) => sum + (p.lastYieldKg ?? 0), 0)),
      events: events.map((e) => ({
        title: e.title,
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
      })),
      market: {
        open: typeof listings === "number" ? listings : 0,
        auctions: auctions.length,
        topBid: Math.round(Math.max(0, ...auctions.map((a) => a.currentPrice ?? 0))),
      },
      health: {
        openDiagnoses: diagnoses.filter((d) => d.status === "OPEN").length,
        lastDisease: diagnoses[0]?.diseaseName ?? null,
      },
      generatedAt: Date.now(),
    };
  } catch (err) {
    // قاعدة بيانات غائبة أو غير مهيّأة: نوفا تبقى تعمل وتقول الحقيقة
    console.error("[nova] تعذّرت قراءة نبضة المزرعة:", err instanceof Error ? err.message : err);
    return empty;
  }
}

/** ملخص نصي مضغوط لطبقة العصب — أرقام حقيقية بدل تخمين */
export function pulseToContext(p: FarmPulse): string {
  if (!p.ok) return "بيانات المزرعة غير متاحة حاليًا.";
  return [
    `المزرعة: ${p.farm?.name ?? "غير مسمّاة"}${p.farm?.address ? ` (${p.farm.address})` : ""}${
      p.farm?.areaHectares ? ` — ${p.farm.areaHectares} هكتار` : ""
    }`,
    `النخيل: ${p.palms.total} إجمالًا — سليمة ${p.palms.healthy}، مريضة ${p.palms.sick}، تحت العلاج ${p.palms.treatment}، فسائل ${p.palms.young}، ميتة ${p.palms.dead}`,
    `الأصناف: ${p.varieties.map((v) => `${v.label} ${v.value}`).join("، ") || "لا بيانات"}`,
    `العمال: ${p.workers.active} نشط، رواتب شهرية ${p.workers.payroll}`,
    `المصاريف: هذا الشهر ${Math.round(p.money.monthTotal)}، هذه السنة ${Math.round(p.money.yearTotal)} — الأعلى: ${
      p.money.byCategory.slice(0, 3).map((c) => `${c.label} ${c.value}`).join("، ") || "لا بيانات"
    }`,
    `الإنتاج المسجّل: ${p.yieldKg} كجم`,
    `التشخيصات المفتوحة: ${p.health.openDiagnoses}${p.health.lastDisease ? ` — آخرها ${p.health.lastDisease}` : ""}`,
    `السوق: ${p.market.open} إعلانًا، ${p.market.auctions} مزادًا مفتوحًا`,
    `أقرب المواعيد: ${p.events.map((e) => `${e.date} ${e.title}`).join(" · ") || "لا مواعيد"}`,
  ].join("\n");
}
