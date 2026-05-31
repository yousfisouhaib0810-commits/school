import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, BookOpen, ShieldCheck, Video } from "lucide-react";
import { RenderEngine } from "@/components/builder/RenderEngine";
import { LandingPageInput } from "@school/shared";
import { notFound } from "next/navigation";

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

    const json = (await res.json()) as { data: LandingPageInput };
    return json.data;
  } catch {
    return null;
  }
}

function PlatformHome() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#17201b]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between border-b border-[#d8d2c3] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6b5f48]">School Platform</p>
            <h1 className="mt-1 text-2xl font-black">منصة المدارس الرقمية</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/70" href="/login">
              تسجيل الدخول
            </Link>
            <Link className="rounded-md bg-[#17201b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#26352d]" href="/register">
              إنشاء حساب
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[#cfc6b5] bg-white/70 px-3 py-1 text-sm font-semibold text-[#6b5f48]">
              SaaS تعليمي متعدد المستأجرين للسوق الجزائري
            </p>
            <h2 className="max-w-3xl text-5xl font-black leading-tight md:text-7xl">
              أنشئ أكاديميتك، انشر دروسك، وابدأ البيع بأمان.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f625c]">
              منصة واحدة لإدارة المواد والدروس والفيديو المحمي والبث المباشر والاشتراكات، مع عزل كامل لكل أكاديمية.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-[#17201b] px-5 py-3 font-bold text-white hover:bg-[#26352d]"
                href="/register"
              >
                ابدأ التجربة <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link className="rounded-md border border-[#cfc6b5] bg-white px-5 py-3 font-bold hover:bg-[#fbfaf7]" href="/login">
                لدي حساب
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              { title: "إدارة المحتوى", text: "مواد، مراحل، دروس، وترتيب مرن.", icon: BookOpen },
              { title: "فيديو محمي", text: "روابط تشغيل موقعة وتقدم مشاهدة.", icon: Video },
              { title: "عزل المستأجرين", text: "كل أكاديمية معزولة على مستوى التطبيق والبيانات.", icon: ShieldCheck },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-[#d8d2c3] bg-white p-5 shadow-sm">
                <item.icon className="mb-4 h-6 w-6 text-[#8a6f35]" />
                <h3 className="text-xl font-black">{item.title}</h3>
                <p className="mt-2 text-[#66685f]">{item.text}</p>
              </div>
            ))}
          </div>
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
      <div className="flex min-h-screen items-center justify-center">
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
