"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const subdomain = searchParams.get("subdomain") ?? "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const response = await apiClient("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, subdomain, code, password }),
    });

    setLoading(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="rounded-lg border border-[#ded6c3] bg-white p-8 shadow-xl">
      <h1 className="mb-2 text-center text-2xl font-black text-[#161c18]">تعيين كلمة مرور جديدة</h1>
      <p className="mb-6 text-center text-sm leading-6 text-[#5d635c]">
        أدخل رمز الاستعادة المرسل إلى {email || "بريدك الإلكتروني"} ثم اختر كلمة مرور جديدة.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {success && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.
          </div>
        )}
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium">
            رمز الاستعادة
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            minLength={6}
            maxLength={6}
            dir="ltr"
            className="w-full rounded-lg border border-border px-4 py-2 text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="000000"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            كلمة المرور الجديدة
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            dir="ltr"
            className="w-full rounded-lg border border-border px-4 py-2 text-left focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email || !subdomain}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار تحديث كلمة المرور..." : "تحديث كلمة المرور"}
        </button>
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
        العودة إلى تسجيل الدخول
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rounded-lg bg-white p-8 text-center shadow-lg">جار التحميل...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
