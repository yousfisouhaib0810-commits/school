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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: apiError } = await apiClient<AuthRegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, subdomain }),
      parse: (responseData) => authRegisterResponseSchema.parse(responseData),
    });

    setLoading(false);

    if (apiError || !data) {
      setError(apiError || "فشل إنشاء الحساب");
      return;
    }

    const params = new URLSearchParams({
      email: data.email,
      subdomain: data.tenant.subdomain,
    });
    router.push(`/verify-email?${params.toString()}`);
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">إنشاء حساب جديد</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            اسم الأكاديمية
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="subdomain" className="block text-sm font-medium mb-1">
            النطاق الفرعي
          </label>
          <input
            id="subdomain"
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
            required
            minLength={3}
            pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
            className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="my-academy"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            كلمة المرور
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار إنشاء الحساب..." : "إنشاء الحساب"}
        </button>
      </form>
    </div>
  );
}
