"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authVerifyEmailResponseSchema } from "@school/shared";
import type { AuthVerifyEmailResponse } from "@school/shared";

import { apiClient } from "@/lib/api";
import { setAccessToken, setTenantSubdomain } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const email = searchParams.get("email") ?? "";
  const subdomain = searchParams.get("subdomain") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: apiError } = await apiClient<AuthVerifyEmailResponse>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, subdomain, code }),
      parse: (responseData) => authVerifyEmailResponseSchema.parse(responseData),
    });

    setLoading(false);

    if (apiError || !data) {
      setError(apiError ?? "فشل تأكيد البريد الإلكتروني");
      return;
    }

    setAccessToken(data.accessToken);
    setTenantSubdomain(data.tenant.subdomain);
    login(data.user, data.accessToken);
    router.push("/");
  }

  async function handleResend() {
    setError("");
    setResending(true);
    const response = await apiClient("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email, subdomain }),
    });
    setResending(false);
    if (response.error) {
      setError(response.error);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-2 text-center text-2xl font-bold">تأكيد البريد الإلكتروني</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        أدخل رمز التحقق المرسل إلى {email || "بريدك الإلكتروني"}.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium">
            رمز التحقق
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
            className="w-full rounded-lg border border-border px-4 py-2 text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="000000"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email || !subdomain}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار التأكيد..." : "تأكيد الحساب"}
        </button>
      </form>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || !email || !subdomain}
        className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {resending ? "جار إعادة الإرسال..." : "إعادة إرسال الرمز"}
      </button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl bg-white p-8 text-center shadow-lg">جار التحميل...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
