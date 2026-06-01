"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PaymentProvider, Plan } from "@school/shared";
import { apiClient } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface PaymentButtonProps {
  plan: Plan;
  label: string;
  provider?: PaymentProvider;
}

const checkoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
});

export function PaymentButton({ plan, label, provider = PaymentProvider.CHARGILY }: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient<{ checkoutUrl: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          provider,
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        }),
        parse: (raw: unknown) => checkoutResponseSchema.parse(raw),
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (response.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      }
    } catch {
      toast.error("Failed to initiate payment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handlePayment} disabled={isLoading || plan === Plan.FREE} className="w-full">
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
