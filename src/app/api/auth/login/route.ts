import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createSession, ensureOwnerAccount } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await ensureOwnerAccount();
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
  }
  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }
  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  return NextResponse.json({ ok: true });
}
