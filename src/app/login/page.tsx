"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@farm.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "تعذر تسجيل الدخول");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-[var(--primary-dark)] to-[var(--primary)] p-4">
      <div className="w-full max-w-sm card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-3xl">
            🌴
          </div>
          <h1 className="text-xl font-bold">نخيلي — إدارة المزرعة</h1>
          <p className="mt-1 text-sm text-gray-500">سجّل الدخول لمتابعة مزرعتك</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--primary)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--primary)] py-2 font-medium text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          الحساب الافتراضي: owner@farm.local — راجع ملف .env لتعديل كلمة المرور
        </p>
      </div>
    </div>
  );
}
