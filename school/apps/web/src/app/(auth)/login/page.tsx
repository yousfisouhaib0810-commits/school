"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authLoginResponseSchema } from "@school/shared";
import type { AuthLoginResponse } from "@school/shared";

import { apiClient } from "@/lib/api";
import { clearAccessToken, setTenantSubdomain } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: apiError } = await apiClient<AuthLoginResponse>("/api/auth/login", {
      method: "POST",
      tenantSubdomain: subdomain,
      body: JSON.stringify({ email, password }),
      parse: (responseData) => authLoginResponseSchema.parse(responseData),
    });

    setLoading(false);

    if (apiError || !data) {
      setError(apiError ?? "فشل تسجيل الدخول");
      return;
    }

    clearAccessToken();
    setTenantSubdomain(subdomain);
    login(data.user);
    router.push(data.user.role === "SUPER_ADMIN" ? "/dashboard" : "/");
  }

  return (
    <div className="rounded-lg border border-[#ded6c3] bg-white p-8 shadow-xl">
      <h1 className="mb-2 text-center text-2xl font-black text-[#161c18]">تسجيل الدخول</h1>
      <p className="mb-6 text-center text-sm leading-6 text-[#5d635c]">
        أدخل بريدك ونطاق الأكاديمية للوصول إلى لوحة التحكم.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            dir="ltr"
            className="w-full rounded-lg border border-border px-4 py-2 text-left focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="subdomain" className="mb-1 block text-sm font-medium">
            النطاق الفرعي للأكاديمية
          </label>
          <input
            id="subdomain"
            type="text"
            value={subdomain}
            onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
            required
            minLength={3}
            pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
            dir="ltr"
            className="w-full rounded-lg border border-border px-4 py-2 text-left focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="my-academy"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium">
              كلمة المرور
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              نسيت كلمة المرور؟
            </Link>
          </div>
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
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار تسجيل الدخول..." : "تسجيل الدخول"}
        </button>
      </form>
    </div>
  );
}
