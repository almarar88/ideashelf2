import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL || "owner@farm.local";
  const ownerPassword = process.env.OWNER_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: "مالك المزرعة",
      passwordHash,
      role: "OWNER",
    },
  });

  let farm = await prisma.farm.findFirst();
  if (!farm) {
    farm = await prisma.farm.create({
      data: {
        name: "مزرعة الواحة الخضراء",
        description: "مزرعة نخيل نموذجية لأغراض العرض التوضيحي",
        address: "الأحساء، المملكة العربية السعودية",
        lat: 25.3838,
        lng: 49.5875,
        areaHectares: 12.5,
      },
    });
  }

  const palmCount = await prisma.palm.count({ where: { farmId: farm.id } });
  if (palmCount === 0) {
    const varieties = ["سكري", "خلاص", "برحي", "صقعي", "عجوة"];
    const statuses = ["HEALTHY", "HEALTHY", "HEALTHY", "SICK", "UNDER_TREATMENT", "YOUNG_SEEDLING"];
    const baseLat = 25.3838;
    const baseLng = 49.5875;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const idx = row * 6 + col;
        await prisma.palm.create({
          data: {
            code: `P-${String(idx + 1).padStart(3, "0")}`,
            farmId: farm.id,
            variety: varieties[idx % varieties.length],
            plantingDate: new Date(2015 + (idx % 8), (idx % 12), 1),
            lat: baseLat + row * 0.0006,
            lng: baseLng + col * 0.0006,
            heightMeters: Math.round((3 + (idx % 10) * 0.8) * 10) / 10,
            status: statuses[idx % statuses.length],
            lastYieldKg: 40 + (idx % 15) * 3,
          },
        });
      }
    }
  }

  const workerCount = await prisma.worker.count({ where: { farmId: farm.id } });
  let workers: { id: string }[] = [];
  if (workerCount === 0) {
    const workerData = [
      { name: "محمد العتيبي", position: "مشرف مزرعة", monthlySalary: 4500, phone: "0501234567" },
      { name: "سالم الدوسري", position: "عامل ري", monthlySalary: 3200, phone: "0559876543" },
      { name: "خالد الشهري", position: "عامل صيانة", monthlySalary: 3000, phone: "0567891234" },
      { name: "أحمد القحطاني", position: "عامل حصاد", monthlySalary: 2800, phone: "0512345678" },
    ];
    for (const w of workerData) {
      const worker = await prisma.worker.create({
        data: {
          farmId: farm.id,
          name: w.name,
          position: w.position,
          monthlySalary: w.monthlySalary,
          phone: w.phone,
          hireDate: new Date(2022, 3, 1),
          status: "ACTIVE",
        },
      });
      workers.push(worker);
    }
  } else {
    workers = await prisma.worker.findMany({ where: { farmId: farm.id }, select: { id: true } });
  }

  const salaryCount = await prisma.salaryPayment.count();
  if (salaryCount === 0) {
    const now = new Date();
    for (const worker of workers) {
      const w = await prisma.worker.findUnique({ where: { id: worker.id } });
      if (!w) continue;
      for (let m = -2; m <= 0; m++) {
        const period = new Date(now.getFullYear(), now.getMonth() + m, 1);
        const periodMonth = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, "0")}`;
        const dueDate = new Date(period.getFullYear(), period.getMonth(), 28);
        await prisma.salaryPayment.create({
          data: {
            workerId: worker.id,
            amount: w.monthlySalary,
            periodMonth,
            dueDate,
            status: m === 0 ? "PENDING" : "PAID",
            paidDate: m === 0 ? null : dueDate,
          },
        });
      }
    }
  }

  const expenseCount = await prisma.expense.count({ where: { farmId: farm.id } });
  if (expenseCount === 0) {
    const now = new Date();
    const categories = ["WATER", "FERTILIZER", "PESTICIDE", "EQUIPMENT", "MAINTENANCE", "FUEL"];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 5);
      await prisma.expense.create({
        data: {
          farmId: farm.id,
          category: categories[i % categories.length],
          amount: 150 + (i % 6) * 220,
          date,
          description: "مصروف تشغيلي دوري",
        },
      });
    }
  }

  const eventCount = await prisma.calendarEvent.count({ where: { farmId: farm.id } });
  if (eventCount === 0) {
    const now = new Date();
    const events = [
      { title: "ري القطاع الشمالي", type: "IRRIGATION", offset: 1 },
      { title: "تسميد النخيل الصغيرة", type: "FERTILIZATION", offset: 3 },
      { title: "رش مبيد وقائي", type: "PESTICIDE_TREATMENT", offset: 5 },
      { title: "صيانة مضخات الري", type: "MAINTENANCE", offset: 7 },
      { title: "بدء موسم الحصاد", type: "HARVEST", offset: 20 },
    ];
    for (const e of events) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + e.offset);
      await prisma.calendarEvent.create({
        data: {
          farmId: farm.id,
          title: e.title,
          date,
          type: e.type,
          recurrence: e.type === "IRRIGATION" ? "WEEKLY" : "NONE",
        },
      });
    }
  }

  const listingCount = await prisma.marketListing.count();
  if (listingCount === 0) {
    await prisma.marketListing.create({
      data: {
        type: "SELL",
        title: "فسائل نخيل سكري ممتازة",
        variety: "سكري",
        description: "فسائل مأخوذة من أمهات منتجة، عمر سنتين، جاهزة للزراعة",
        price: 350,
        quantity: 20,
        unit: "فسيلة",
        sellerName: "مشتل الواحة",
        contact: "0501112233",
        location: "الأحساء",
        status: "ACTIVE",
      },
    });
    await prisma.marketListing.create({
      data: {
        type: "BUY",
        title: "مطلوب فسائل خلاص",
        variety: "خلاص",
        description: "نبحث عن كمية 50 فسيلة خلاص لمزرعة جديدة",
        price: 300,
        quantity: 50,
        unit: "فسيلة",
        sellerName: "مزرعة الروضة",
        contact: "0559998877",
        location: "القصيم",
        status: "ACTIVE",
      },
    });
  }

  const auctionCount = await prisma.auction.count();
  if (auctionCount === 0) {
    const now = new Date();
    await prisma.auction.create({
      data: {
        title: "مزاد فسيلة عجوة نادرة",
        description: "فسيلة عجوة أصلية عمر 3 سنوات من مصدر موثوق",
        variety: "عجوة",
        startPrice: 500,
        currentPrice: 500,
        bidStep: 25,
        startAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
        endAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 2),
        status: "ACTIVE",
      },
    });
  }

  console.log("تمت تعبئة البيانات التجريبية بنجاح");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
