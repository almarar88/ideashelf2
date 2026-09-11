import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "farm_session";
/**
 * نوفا (/os) نظام تشغيل عام يعيش في المتصفح بالكامل: حالته على جهاز
 * المستخدم ولا يقرأ بيانات الخادم، فلا معنى لأن يحجبه تسجيل دخول.
 * أما /api/nova/* فتبقى محميّة لأنها تصرف مفتاح Claude — وذاك حماية
 * كلفة لا حماية بيانات، ولهذا تعمل نوفا كاملة بلا دخول بطبقة الانعكاس.
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/os"];

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, getSecretKey());
    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
