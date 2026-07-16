import { prisma } from "@/lib/prisma";

export async function getDefaultFarm() {
  let farm = await prisma.farm.findFirst({ orderBy: { createdAt: "asc" } });
  if (!farm) {
    farm = await prisma.farm.create({ data: { name: "مزرعتي" } });
  }
  return farm;
}
