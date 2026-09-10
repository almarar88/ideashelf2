import type { FarmPulse } from "./bridge";

/**
 * جانب العميل من جسر المزرعة.
 * منفصل عن bridge.ts لأن ذاك يلمس Prisma ولا يجوز أن يصل إلى المتصفح؛
 * ما يُشترك هو النوع فقط (نوع لا يُصدر كودًا).
 */
export async function fetchPulse(): Promise<FarmPulse | null> {
  try {
    const res = await fetch("/api/nova/farm", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FarmPulse;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

const money = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });

export function pulseToMarkdown(p: FarmPulse): string {
  return [
    `# تقرير نبضة المزرعة`,
    "",
    `**المزرعة:** ${p.farm?.name ?? "غير مسمّاة"}${p.farm?.address ? ` — ${p.farm.address}` : ""}`,
    `**وقت التقرير:** ${new Date(p.generatedAt).toLocaleString("ar")}`,
    "",
    "## النخيل",
    `- الإجمالي: ${p.palms.total}`,
    `- سليمة: ${p.palms.healthy} · مريضة: ${p.palms.sick} · تحت العلاج: ${p.palms.treatment}`,
    `- فسائل: ${p.palms.young} · ميتة: ${p.palms.dead}`,
    `- الأصناف: ${p.varieties.map((v) => `${v.label} (${v.value})`).join("، ") || "لا بيانات"}`,
    "",
    "## المال",
    `- مصاريف هذا الشهر: ${money(Math.round(p.money.monthTotal))}`,
    `- مصاريف هذه السنة: ${money(Math.round(p.money.yearTotal))}`,
    `- رواتب شهرية: ${money(Math.round(p.workers.payroll))}`,
    ...p.money.byCategory.map((c) => `- ${c.label}: ${money(c.value)}`),
    "",
    "## العمل والصحة",
    `- عمال نشطون: ${p.workers.active}`,
    `- تشخيصات مفتوحة: ${p.health.openDiagnoses}${p.health.lastDisease ? ` (آخرها: ${p.health.lastDisease})` : ""}`,
    `- الإنتاج المسجّل: ${money(p.yieldKg)} كجم`,
    "",
    "## السوق",
    `- إعلانات نشطة: ${p.market.open} · مزادات مفتوحة: ${p.market.auctions}${
      p.market.topBid ? ` · أعلى سعر حالي: ${money(p.market.topBid)}` : ""
    }`,
    "",
    "## أقرب المواعيد",
    ...(p.events.length ? p.events.map((e) => `- ${e.date} — ${e.title}`) : ["- لا مواعيد قادمة"]),
    "",
    "> وُلّد من داخل نوفا عبر نداء farm.report، قراءةً من قاعدة بيانات التطبيق.",
  ].join("\n");
}
