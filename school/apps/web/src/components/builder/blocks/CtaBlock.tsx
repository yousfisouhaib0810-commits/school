import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CtaBlockProps {
  props: {
    text: string;
    url: string;
    variant?: "primary" | "secondary";
  };
}

export function CtaBlockComponent({ props }: CtaBlockProps) {
  const isSecondary = props.variant === "secondary";

  return (
    <section className={`w-full py-16 ${isSecondary ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
      <div className="container px-4 md:px-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-6">
          Ready to get started?
        </h2>
        <Link href={props.url}>
          <Button
            size="lg"
            variant={isSecondary ? "default" : "secondary"}
            className="px-8"
          >
            {props.text}
          </Button>
        </Link>
      </div>
    </section>
  );
}