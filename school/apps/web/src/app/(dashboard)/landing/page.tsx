"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { landingPageSchema, type LandingPageBlock, type LandingPageInput } from "@school/shared";
import { RenderEngine } from "@/components/builder/RenderEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

type BlockType = LandingPageBlock["type"];

const DEFAULT_BLOCKS: LandingPageBlock[] = [
  {
    type: "hero",
    props: {
      title: "أكاديمية رقمية جاهزة للتوسع",
      subtitle: "صفحة هبوط عربية تعرض الدروس، الاشتراكات، والجلسات المباشرة بثقة.",
      bg: "#f8fafc",
      ctaText: "ابدأ الآن",
      ctaUrl: "/register",
    },
  },
  {
    type: "pricing",
    props: {
      plans: ["monthly", "yearly"],
      monthlyPrice: 5000,
      yearlyPrice: 15000,
    },
  },
];

const DEFAULT_LANDING_PAGE: LandingPageInput = {
  blocks: DEFAULT_BLOCKS,
  published: false,
};

const landingPageRecordSchema = z.object({
  blocks: landingPageSchema.shape.blocks,
  published: z.boolean().default(false),
}).passthrough();

const apiLandingEnvelopeSchema = landingPageRecordSchema.transform((value) => ({
  blocks: value.blocks,
  published: value.published,
}));

const blockTypes: Array<{ type: BlockType; label: string; icon: typeof Megaphone }> = [
  { type: "hero", label: "واجهة", icon: Megaphone },
  { type: "text", label: "نص", icon: FileText },
  { type: "pricing", label: "أسعار", icon: WalletCards },
  { type: "cta", label: "دعوة", icon: Eye },
];

function createBlock(type: BlockType): LandingPageBlock {
  switch (type) {
    case "hero":
      return { type: "hero", props: { title: "عنوان الصفحة", subtitle: "وصف مختصر", bg: "#f8fafc" } };
    case "pricing":
      return { type: "pricing", props: { plans: ["monthly"], monthlyPrice: 5000 } };
    case "text":
      return { type: "text", props: { content: "اكتب نصاً واضحاً للزوار.", align: "center" } };
    case "cta":
      return { type: "cta", props: { text: "سجل الآن", url: "/register", variant: "primary" } };
  }
}

function replaceBlock(blocks: LandingPageBlock[], index: number, nextBlock: LandingPageBlock): LandingPageBlock[] {
  return blocks.map((block, blockIndex) => (blockIndex === index ? nextBlock : block));
}

function moveBlock(blocks: LandingPageBlock[], index: number, direction: -1 | 1): LandingPageBlock[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return blocks;
  }

  const nextBlocks = [...blocks];
  const current = nextBlocks[index];
  const target = nextBlocks[targetIndex];
  if (!current || !target) {
    return blocks;
  }
  nextBlocks[index] = target;
  nextBlocks[targetIndex] = current;
  return nextBlocks;
}

function parseLandingEnvelope(raw: unknown): LandingPageInput {
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    return apiLandingEnvelopeSchema.parse(raw.data);
  }

  return apiLandingEnvelopeSchema.parse(raw);
}

function getBlockLabel(block: LandingPageBlock): string {
  const config = blockTypes.find((item) => item.type === block.type);
  return config?.label ?? block.type;
}

function BlockEditor({
  block,
  index,
  onChange,
}: {
  block: LandingPageBlock;
  index: number;
  onChange: (index: number, block: LandingPageBlock) => void;
}) {
  if (block.type === "hero") {
    return (
      <div className="space-y-3">
        <Input value={block.props.title} onChange={(event) => onChange(index, { ...block, props: { ...block.props, title: event.target.value } })} />
        <Input value={block.props.subtitle ?? ""} onChange={(event) => onChange(index, { ...block, props: { ...block.props, subtitle: event.target.value } })} />
        <div className="grid gap-3 md:grid-cols-3">
          <Input type="color" value={block.props.bg ?? "#ffffff"} onChange={(event) => onChange(index, { ...block, props: { ...block.props, bg: event.target.value } })} />
          <Input value={block.props.ctaText ?? ""} onChange={(event) => onChange(index, { ...block, props: { ...block.props, ctaText: event.target.value } })} />
          <Input value={block.props.ctaUrl ?? ""} onChange={(event) => onChange(index, { ...block, props: { ...block.props, ctaUrl: event.target.value } })} />
        </div>
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <div className="space-y-3">
        <textarea
          className="min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={block.props.content}
          onChange={(event) => onChange(index, { ...block, props: { ...block.props, content: event.target.value } })}
        />
        <select
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          value={block.props.align ?? "center"}
          onChange={(event) => {
            const align = z.enum(["left", "center", "right"]).parse(event.target.value);
            onChange(index, { ...block, props: { ...block.props, align } });
          }}
        >
          <option value="right">يمين</option>
          <option value="center">وسط</option>
          <option value="left">يسار</option>
        </select>
      </div>
    );
  }

  if (block.type === "pricing") {
    const plans = new Set(block.props.plans);
    return (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={plans.has("monthly")}
              onChange={(event) => {
                const nextPlans = event.target.checked
                  ? [...plans, "monthly"]
                  : block.props.plans.filter((plan) => plan !== "monthly");
                onChange(index, { ...block, props: { ...block.props, plans: z.array(z.enum(["monthly", "yearly"])).parse(nextPlans) } });
              }}
            />
            شهري
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={plans.has("yearly")}
              onChange={(event) => {
                const nextPlans = event.target.checked
                  ? [...plans, "yearly"]
                  : block.props.plans.filter((plan) => plan !== "yearly");
                onChange(index, { ...block, props: { ...block.props, plans: z.array(z.enum(["monthly", "yearly"])).parse(nextPlans) } });
              }}
            />
            سنوي
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input type="number" value={block.props.monthlyPrice ?? 0} onChange={(event) => onChange(index, { ...block, props: { ...block.props, monthlyPrice: Number(event.target.value) } })} />
          <Input type="number" value={block.props.yearlyPrice ?? 0} onChange={(event) => onChange(index, { ...block, props: { ...block.props, yearlyPrice: Number(event.target.value) } })} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Input value={block.props.text} onChange={(event) => onChange(index, { ...block, props: { ...block.props, text: event.target.value } })} />
      <Input value={block.props.url} onChange={(event) => onChange(index, { ...block, props: { ...block.props, url: event.target.value } })} />
      <select
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        value={block.props.variant ?? "primary"}
        onChange={(event) => {
          const variant = z.enum(["primary", "secondary"]).parse(event.target.value);
          onChange(index, { ...block, props: { ...block.props, variant } });
        }}
      >
        <option value="primary">أساسي</option>
        <option value="secondary">ثانوي</option>
      </select>
    </div>
  );
}

export default function LandingPageAdmin() {
  const [landingPage, setLandingPage] = useState<LandingPageInput>(DEFAULT_LANDING_PAGE);
  const [selectedType, setSelectedType] = useState<BlockType>("hero");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const validationResult = useMemo(() => landingPageSchema.safeParse(landingPage), [landingPage]);

  useEffect(() => {
    async function fetchLanding() {
      try {
        const response = await apiClient<LandingPageInput>("/api/landing/admin", { parse: parseLandingEnvelope });
        if (response.error) {
          throw new Error(response.error);
        }

        setLandingPage(response.data ?? DEFAULT_LANDING_PAGE);
      } catch {
        toast.error("تعذر تحميل صفحة الهبوط");
        setLandingPage(DEFAULT_LANDING_PAGE);
      } finally {
        setLoading(false);
      }
    }

    void fetchLanding();
  }, []);

  function updateBlock(index: number, block: LandingPageBlock) {
    setLandingPage((current) => ({ ...current, blocks: replaceBlock(current.blocks, index, block) }));
  }

  async function handleSave(nextPublished = landingPage.published) {
    const payload = landingPageSchema.safeParse({ ...landingPage, published: nextPublished });
    if (!payload.success) {
      setValidationMessage("تحقق من محتوى البلوكات قبل الحفظ.");
      return;
    }

    setSaving(true);
    setValidationMessage(null);
    try {
      const response = await apiClient("/api/landing", {
        method: "PUT",
        body: JSON.stringify(payload.data),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setLandingPage(payload.data);
      toast.success(nextPublished ? "تم نشر صفحة الهبوط" : "تم حفظ المسودة");
    } catch {
      toast.error("فشل حفظ صفحة الهبوط");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#17202a]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[420px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[#cbd6e2] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">محرر صفحة الهبوط</h1>
                <p className="mt-1 text-sm text-[#5d6775]">تحكم بالبلوكات، راجع المعاينة، ثم احفظ كمسودة أو انشر.</p>
              </div>
              <span className="rounded-md bg-[#0f766e] px-2 py-1 text-xs font-semibold text-white">
                {landingPage.published ? "منشورة" : "مسودة"}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                className="h-9 rounded-lg border border-[#cbd6e2] bg-white px-3 text-sm"
                value={selectedType}
                onChange={(event) => setSelectedType(z.enum(["hero", "text", "pricing", "cta"]).parse(event.target.value))}
              >
                {blockTypes.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => setLandingPage((current) => ({ ...current, blocks: [...current.blocks, createBlock(selectedType)] }))}
              >
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {landingPage.blocks.map((block, index) => {
              const blockConfig = blockTypes.find((item) => item.type === block.type);
              const Icon = blockConfig?.icon ?? FileText;
              return (
                <section key={`${block.type}-${index}`} className="rounded-lg border border-[#cbd6e2] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#dff5f0] text-[#0f766e]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold">{getBlockLabel(block)}</h2>
                        <p className="text-xs text-[#5d6775]">بلوك {index + 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setLandingPage((current) => ({ ...current, blocks: moveBlock(current.blocks, index, -1) }))}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setLandingPage((current) => ({ ...current, blocks: moveBlock(current.blocks, index, 1) }))}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="destructive" onClick={() => setLandingPage((current) => ({ ...current, blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <BlockEditor block={block} index={index} onChange={updateBlock} />
                </section>
              );
            })}
          </div>
        </aside>

        <main className="space-y-4">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd6e2] bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              <span>{validationResult.success ? "المعاينة جاهزة" : "المعاينة تحتاج تصحيحاً"}</span>
              {validationMessage && <span className="text-destructive">{validationMessage}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave(false)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ مسودة
              </Button>
              <Button type="button" disabled={saving || !validationResult.success} onClick={() => void handleSave(true)}>
                نشر
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#cbd6e2] bg-white shadow-sm">
            <RenderEngine blocks={validationResult.success ? validationResult.data.blocks : []} />
            {!validationResult.success && (
              <div className="p-8 text-center text-sm text-destructive">
                لا يمكن عرض المعاينة حتى تصبح البلوكات صالحة.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
