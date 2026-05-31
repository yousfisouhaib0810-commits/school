interface TextBlockProps {
  props: {
    content: string;
    align?: "left" | "center" | "right";
  };
}

export function TextBlockComponent({ props }: TextBlockProps) {
  const alignmentClass =
    props.align === "left"
      ? "text-left"
      : props.align === "right"
      ? "text-right"
      : "text-center";

  return (
    <section className="w-full py-12">
      <div className={`container px-4 md:px-6 max-w-4xl mx-auto ${alignmentClass}`}>
        <div
          className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: props.content }}
        />
      </div>
    </section>
  );
}