import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

// For super-admin we check the JWT here directly (or we could use an API route)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback_secret_for_dev_only");

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "SUPER_ADMIN") {
      redirect("/login"); // or 403 route
    }
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-slate-50 flex flex-col">
      <header className="px-6 py-4 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
        <div className="font-bold text-xl tracking-tight text-white">SuperAdmin Control</div>
        <div className="text-sm text-neutral-400">Global Campus Management</div>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}