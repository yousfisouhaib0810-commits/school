import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PricingBlockProps {
  props: {
    plans: ("monthly" | "yearly")[];
    monthlyPrice?: number;
    yearlyPrice?: number;
  };
}

export function PricingBlockComponent({ props }: PricingBlockProps) {
  const hasMonthly = props.plans.includes("monthly");
  const hasYearly = props.plans.includes("yearly");

  return (
    <section className="w-full py-16 lg:py-24 bg-muted/30">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Our Pricing</h2>
          <p className="text-muted-foreground mt-2">Choose the best plan for you</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Plan defaults */}
          <div className="border rounded-xl p-6 bg-card text-card-foreground shadow font-sans">
            <h3 className="font-semibold text-xl mb-2">Free</h3>
            <p className="text-4xl font-bold mb-4">0 DZD</p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Access to demo lessons</li>
            </ul>
            <Link href="/register"><Button variant="outline" className="w-full">Sign Up</Button></Link>
          </div>

          {/* Pro Plan */}
          {hasMonthly && (
            <div className="border rounded-xl p-6 bg-primary text-primary-foreground shadow font-sans relative">
              <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">Popular</div>
              <h3 className="font-semibold text-xl mb-2">Pro</h3>
              <p className="text-4xl font-bold mb-4">{props.monthlyPrice || 5000} DZD<span className="text-sm font-normal opacity-80"> / month</span></p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-300" /> Full Classes Access</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-300" /> Live Sessions (Jitsi)</li>
              </ul>
              <Link href="/register"><Button variant="secondary" className="w-full">Upgrade Pro</Button></Link>
            </div>
          )}

          {/* Enterprise Plan */}
          {hasYearly && (
             <div className="border rounded-xl p-6 bg-card text-card-foreground shadow font-sans">
                <h3 className="font-semibold text-xl mb-2">Enterprise</h3>
                <p className="text-4xl font-bold mb-4">{props.yearlyPrice || 15000} DZD<span className="text-sm font-normal text-muted-foreground"> / year</span></p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> All Pro Features</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 1-on-1 Mentoring</li>
                </ul>
                <Link href="/register"><Button variant="outline" className="w-full">Upgrade Enterprise</Button></Link>
             </div>
          )}
        </div>
      </div>
    </section>
  );
}
