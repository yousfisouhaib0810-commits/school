import { LandingPageBlock } from "@school/shared";
import { HeroBlockComponent } from "./blocks/HeroBlock";
import { PricingBlockComponent } from "./blocks/PricingBlock";
import { TextBlockComponent } from "./blocks/TextBlock";
import { CtaBlockComponent } from "./blocks/CtaBlock";

export function RenderEngine({ blocks }: { blocks: LandingPageBlock[] }) {
  return (
    <div className="flex flex-col w-full">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "hero":
            return <HeroBlockComponent key={index} props={block.props} />;
          case "pricing":
            return <PricingBlockComponent key={index} props={block.props} />;
          case "text":
            return <TextBlockComponent key={index} props={block.props} />;
          case "cta":
            return <CtaBlockComponent key={index} props={block.props} />;
          default:
            return null;
        }
      })}
    </div>
  );
}