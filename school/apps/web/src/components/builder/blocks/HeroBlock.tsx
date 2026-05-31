import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroBlockProps {
  props: {
    title: string;
    subtitle?: string;
    bg?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
}

export function HeroBlockComponent({ props }: HeroBlockProps) {
  return (
    <section
      className="w-full py-24 lg:py-32 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor: props.bg || "#ffffff" }}
    >
      <div className="container px-4 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground">
          {props.title}
        </h1>
        {props.subtitle && (
          <p className="mt-4 max-w-[700px] mx-auto text-xl text-muted-foreground">
            {props.subtitle}
          </p>
        )}
        {props.ctaText && props.ctaUrl && (
          <div className="mt-8 flex justify-center">
            <Link href={props.ctaUrl}>
              <Button size="lg" className="h-12 px-8 text-lg">
                {props.ctaText}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}