import { BookOpenCheck, ShieldCheck, UserRound } from "lucide-react";

const profileItems = [
  {
    icon: UserRound,
    title: "الملف الدراسي",
    description: "ستظهر هنا بيانات الطالب الأساسية بعد ربطها من لوحة الإدارة.",
  },
  {
    icon: ShieldCheck,
    title: "حالة الحساب",
    description: "الوصول إلى الفيديو والحصص المباشرة يعتمد على حالة الاشتراك.",
  },
  {
    icon: BookOpenCheck,
    title: "التقدم",
    description: "اكتمال الدروس يسجل تلقائياً من صفحة تشغيل الدرس.",
  },
];

export default function ProfilePage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">الملف الشخصي</h1>
        <p className="mt-2 text-muted-foreground">مركز الطالب لمراجعة الحساب، الاشتراك، والتقدم الدراسي.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {profileItems.map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.title} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
