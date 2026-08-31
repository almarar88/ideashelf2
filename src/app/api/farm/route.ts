import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultFarm } from "@/lib/farm";

export async function GET() {
  const farm = await getDefaultFarm();
  return NextResponse.json(farm);
}

export async function PATCH(req: NextRequest) {
  const farm = await getDefaultFarm();
  const body = await req.json();
  const updated = await prisma.farm.update({
    where: { id: farm.id },
    data: {
      name: body.name ?? farm.name,
      description: body.description ?? farm.description,
      address: body.address ?? farm.address,
      lat: body.lat ?? farm.lat,
      lng: body.lng ?? farm.lng,
      areaHectares: body.areaHectares ?? farm.areaHectares,
    },
  });
  return NextResponse.json(updated);
}
