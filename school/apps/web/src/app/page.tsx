import { headers } from "next/headers";
import { RenderEngine } from "@/components/builder/RenderEngine";
import { LandingPageInput } from "@school/shared";
import { notFound } from "next/navigation";

async function getLandingPage(subdomain: string): Promise<LandingPageInput | null> {
  try {
    const res = await fetch(`http://localhost:4000/api/landing`, {
       headers: {
          "x-tenant-subdomain": subdomain,
       },
       next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!res.ok) {
       return null;
    }
    
    const json = await res.json() as { data: LandingPageInput };
    return json.data;
  } catch (error) {
    console.error("Failed to fetch landing page", error);
    return null;
  }
}

export default async function HomePage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");

  // If there's no subdomain and we are on the root domain, show the platform default landing.
  if (!subdomain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-xl">
          <h1 className="text-5xl font-extrabold mb-6">School Platform</h1>
          <p className="text-muted-foreground text-xl leading-relaxed">
            Enterprise-grade, multi-tenant educational SaaS platform built for the Algerian market.
          </p>
        </div>
      </div>
    );
  }

  const landingPage = await getLandingPage(subdomain);

  if (!landingPage || !landingPage.published) {
     if (!landingPage) return notFound();
     return (
       <div className="flex min-h-screen items-center justify-center">
         <h1 className="text-2xl font-bold">This campus is not published yet.</h1>
       </div>
     );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <RenderEngine blocks={landingPage.blocks} />
    </main>
  );
}
