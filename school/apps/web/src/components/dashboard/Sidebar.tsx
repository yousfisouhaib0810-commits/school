"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Video,
  Users,
  Settings,
  Radio,
  Layers,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { clearAccessToken } from "@/lib/auth";

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
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = () => {
    clearAccessToken();
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-l border-border min-h-screen p-4 flex flex-col justify-between">
      <div>
        <div className="mb-8 px-2 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">الأكاديمية</h2>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
