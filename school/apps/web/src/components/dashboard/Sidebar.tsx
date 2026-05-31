"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Radio,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { clearAccessToken, clearTenantSubdomain } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

const NAV_ITEMS = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/subjects", label: "المواد", icon: BookOpen },
  { href: "/stages", label: "المراحل", icon: Layers },
  { href: "/lessons", label: "الدروس", icon: GraduationCap },
  { href: "/videos", label: "الفيديو", icon: Video },
  { href: "/students", label: "الطلاب", icon: Users },
  { href: "/live", label: "البث المباشر", icon: Radio },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    clearAccessToken();
    clearTenantSubdomain();
    logout();
    router.push("/login");
  };

  return (
    <aside className="flex min-h-screen w-64 flex-col justify-between border-l border-border bg-white p-4">
      <div>
        <div className="mb-8 flex items-center justify-between px-2">
          <h2 className="text-xl font-bold text-primary">الأكاديمية</h2>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-5 w-5" />
        تسجيل الخروج
      </button>
    </aside>
  );
}
