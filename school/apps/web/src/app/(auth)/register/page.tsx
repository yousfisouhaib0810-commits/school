"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authRegisterResponseSchema } from "@school/shared";
import type { AuthRegisterResponse } from "@school/shared";

import { apiClient } from "@/lib/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: apiError } = await apiClient<AuthRegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, subdomain }),
      parse: (responseData) => authRegisterResponseSchema.parse(responseData),
    });

    setLoading(false);

    if (apiError || !data) {
      setError(apiError ?? "فشل إنشاء الحساب");
      return;
    }

    const params = new URLSearchParams({
      email: data.email,
      subdomain: data.tenant.subdomain,
    });
    router.push(`/verify-email?${params.toString()}`);
  }

  return (
    <div className="rounded-lg border border-[#ded6c3] bg-white p-8 shadow-xl">
      <h1 className="mb-2 text-center text-2xl font-black text-[#161c18]">إنشاء حساب أكاديمية</h1>
      <p className="mb-6 text-center text-sm leading-6 text-[#5d635c]">
        أنشئ مساحة مستقلة، ثم أدخل رمز التحقق الذي يصلك عبر البريد الإلكتروني.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            اسم الأكاديمية
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="subdomain" className="mb-1 block text-sm font-medium">
            النطاق الفرعي
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
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            كلمة المرور
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
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار إنشاء الحساب..." : "إنشاء الحساب"}
        </button>
      </form>
    </div>
  );
}
