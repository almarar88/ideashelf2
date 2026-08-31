import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const listings = await prisma.marketListing.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.sellerName || !body.type) {
    return NextResponse.json({ error: "العنوان واسم البائع والنوع مطلوبة" }, { status: 400 });
  }
  const listing = await prisma.marketListing.create({
    data: {
      type: body.type,
      title: body.title,
      variety: body.variety ?? null,
      description: body.description ?? null,
      price: body.price ? Number(body.price) : null,
      quantity: body.quantity ? Number(body.quantity) : 1,
      unit: body.unit ?? "فسيلة",
      images: body.images ? JSON.stringify(body.images) : null,
      sellerName: body.sellerName,
      contact: body.contact ?? null,
      location: body.location ?? null,
      status: "ACTIVE",
    },
  });
  return NextResponse.json(listing, { status: 201 });
}
