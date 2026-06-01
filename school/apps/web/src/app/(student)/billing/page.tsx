import { PaymentButton } from "@/components/shared/PaymentButton";
import { PaymentProvider, Plan } from "@school/shared";
import { Check } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscriptions</h1>
        <p className="text-muted-foreground">Manage your plan and billing details.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* FREE Plan */}
        <div className="border rounded-lg p-6 relative">
           <h3 className="font-semibold text-lg mb-2">Free</h3>
           <p className="text-3xl font-bold mb-4">0 DZD<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
           <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Demo Lessons</li>
           </ul>
           <PaymentButton plan={Plan.FREE} label="Current Plan" />
        </div>

        {/* PRO Plan */}
        <div className="border rounded-lg p-6 relative border-primary bg-primary/5">
           <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg font-medium">Popular</div>
           <h3 className="font-semibold text-lg mb-2">Pro</h3>
           <p className="text-3xl font-bold mb-4">5000 DZD<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
           <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Full Classes Access</li>
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Live Jitsi Seminars</li>
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> PDF Downloads</li>
           </ul>
           <div className="space-y-2">
              <PaymentButton plan={Plan.PRO} provider={PaymentProvider.CHARGILY} label="Chargily ePay (CIB / EDAHABIA)" />
              <PaymentButton plan={Plan.PRO} provider={PaymentProvider.STRIPE} label="Stripe international card" />
           </div>
        </div>

        {/* ENTERPRISE Plan */}
        <div className="border rounded-lg p-6 relative">
           <h3 className="font-semibold text-lg mb-2">Enterprise</h3>
           <p className="text-3xl font-bold mb-4">15000 DZD<span className="text-sm font-normal text-muted-foreground"> / year</span></p>
           <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> All Pro Features</li>
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> 1-on-1 Mentoring</li>
              <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Premium Support</li>
           </ul>
           <div className="space-y-2">
              <PaymentButton plan={Plan.ENTERPRISE} provider={PaymentProvider.CHARGILY} label="Chargily ePay" />
              <PaymentButton plan={Plan.ENTERPRISE} provider={PaymentProvider.STRIPE} label="Stripe international card" />
           </div>
        </div>
      </div>
    </div>
  );
}
