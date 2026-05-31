import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Radio, ShieldCheck, Video } from "lucide-react";
import { landingPageSchema, type LandingPageInput } from "@school/shared";
import { RenderEngine } from "@/components/builder/RenderEngine";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function getLandingPage(subdomain: string): Promise<LandingPageInput | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/landing`, {
      headers: {
        "x-tenant-subdomain": subdomain,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return null;
    }

    const json: unknown = await res.json();
    const responseSchema = landingPageSchema.pick({ blocks: true, published: true });
    const payload = responseSchema.safeParse(
      typeof json === "object" && json !== null && "data" in json ? json.data : null
    );

    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}

const features = [
  {
    title: "إدارة المحتوى",
    text: "مواد، مراحل، دروس وترتيب واضح للمعلمين بدون تعقيد.",
    icon: BookOpen,
  },
  {
    title: "فيديو محمي",
    text: "رفع عبر Cloudflare Stream وروابط تشغيل موقعة بعلامات مائية.",
    icon: Video,
  },
  {
    title: "حصص مباشرة",
    text: "جلسات مباشرة مرتبطة بالدروس مع تحكم في الوصول.",
    icon: Radio,
  },
  {
    title: "عزل المستأجرين",
    text: "كل أكاديمية معزولة على مستوى التطبيق والبيانات.",
    icon: ShieldCheck,
  },
];

function PlatformHome() {
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#161c18]">
      <section className="mx-auto flex min-h-[92vh] w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between gap-4 border-b border-[#ded6c3] pb-5">
          <Link href="/" className="text-lg font-black tracking-tight">
            School Platform
          </Link>
          <div className="flex items-center gap-2">
            <Link className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/70" href="/login">
              تسجيل الدخول
            </Link>
            <Link className="rounded-md bg-[#161c18] px-4 py-2 text-sm font-semibold text-white hover:bg-[#26352d]" href="/register">
              إنشاء حساب
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-[#cfc6b5] bg-white/80 px-3 py-1 text-sm font-semibold text-[#766640]">
              منصة تعليمية متعددة المستأجرين للسوق الجزائري
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">
              أنشئ أكاديميتك، انشر دروسك، وابدأ استقبال الطلاب بأمان.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d635c]">
              صفحة تسجيل، لوحة إدارة، محتوى تعليمي، فيديو محمي، حصص مباشرة، واشتراكات في نظام واحد مصمم للعمل كمنتج
              SaaS حقيقي.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-[#161c18] px-5 py-3 font-bold text-white hover:bg-[#26352d]"
                href="/register"
              >
                ابدأ التجربة <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link className="rounded-md border border-[#cfc6b5] bg-white px-5 py-3 font-bold hover:bg-[#fbfaf7]" href="/login">
                لدي حساب
              </Link>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-[#ded6c3] bg-[#161c18] shadow-2xl">
            <Image
              src="https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1400&q=85"
              alt="طلاب داخل قاعة دراسة رقمية"
              fill
              priority
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="object-cover opacity-[0.88]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-[#161c18]/88 p-5 text-white backdrop-blur">
              <p className="text-sm font-semibold text-[#e8d8a7]">جاهز لتجربة المنتج</p>
              <p className="mt-2 text-2xl font-black">أنشئ الحساب، أكد البريد، ثم ادخل إلى لوحة التحكم.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ded6c3] bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {features.map((item) => (
            <div key={item.title} className="rounded-lg border border-[#e3ddcf] bg-[#fbfaf6] p-5">
              <item.icon className="mb-4 h-6 w-6 text-[#8a6f35]" />
              <h2 className="text-lg font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#62685f]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default async function HomePage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");

  if (!subdomain) {
    return <PlatformHome />;
  }

  const landingPage = await getLandingPage(subdomain);

  if (!landingPage || !landingPage.published) {
    if (!landingPage) return notFound();
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">هذه الأكاديمية غير منشورة بعد.</h1>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <RenderEngine blocks={landingPage.blocks} />
    </main>
  );
}
