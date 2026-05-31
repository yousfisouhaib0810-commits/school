"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await apiClient("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, subdomain }),
    });

    setLoading(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    const params = new URLSearchParams({ email, subdomain });
    router.push(`/reset-password?${params.toString()}`);
  }

  return (
    <div className="rounded-lg border border-[#ded6c3] bg-white p-8 shadow-xl">
      <h1 className="mb-2 text-center text-2xl font-black text-[#161c18]">استعادة كلمة المرور</h1>
      <p className="mb-6 text-center text-sm leading-6 text-[#5d635c]">
        أدخل بريدك ونطاق الأكاديمية، وسنرسل رمزاً لإعادة تعيين كلمة المرور إن كان الحساب موجوداً.
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "جار إرسال الرمز..." : "إرسال رمز الاستعادة"}
        </button>
      </form>
    </div>
  );
}
