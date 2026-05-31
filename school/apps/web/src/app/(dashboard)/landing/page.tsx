"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { landingPageSchema, type LandingPageInput } from "@school/shared";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";

const defaultLandingPage: LandingPageInput = {
  blocks: [{ type: "hero", props: { title: "أكاديميتي", subtitle: "تعلم بثقة", bg: "#ffffff" } }],
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

export default function LandingPageAdmin() {
  const [data, setData] = useState<LandingPageInput | null>(null);
  const [blocksJson, setBlocksJson] = useState(JSON.stringify(defaultLandingPage.blocks, null, 2));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchLanding() {
      try {
        const res = await apiClient<LandingPageInput>("/api/landing/admin", {
          parse: (raw: unknown) => {
            if (typeof raw === "object" && raw !== null && "data" in raw) {
              return apiLandingEnvelopeSchema.parse(raw.data);
            }

            return apiLandingEnvelopeSchema.parse(raw);
          },
        });

        if (res.error) {
          throw new Error(res.error);
        }

        const nextData = res.data ?? defaultLandingPage;
        setData(nextData);
        setBlocksJson(JSON.stringify(nextData.blocks, null, 2));
      } catch {
        toast.error("فشل تحميل صفحة الهبوط");
        setData(defaultLandingPage);
      } finally {
        setLoading(false);
      }
    }

    void fetchLanding();
  }, []);

  const handleSave = async () => {
    if (!data) {
      return;
    }

    setSaving(true);
    try {
      const parsedBlocks: unknown = JSON.parse(blocksJson);
      const payload = landingPageSchema.parse({
        blocks: parsedBlocks,
        published: data.published,
      });

      const res = await apiClient("/api/landing", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setData(payload);
      setBlocksJson(JSON.stringify(payload.blocks, null, 2));
      toast.success("تم تحديث صفحة الهبوط");
    } catch {
      toast.error("فشل الحفظ. تأكد أن JSON يطابق أنواع hero وpricing وtext وcta.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="animate-spin mx-auto h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">محرر صفحة الهبوط</h1>
          <p className="text-muted-foreground">أدر البلوكات المنشورة لصفحة الأكاديمية عبر JSON موثّق.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          حفظ التغييرات
        </Button>
      </div>

      <div className="space-y-6">
        <label className="flex items-center gap-3 bg-muted p-4 rounded-md border">
          <input
            type="checkbox"
            checked={data?.published || false}
            onChange={(event) => setData((currentData) => currentData ? { ...currentData, published: event.target.checked } : null)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="font-medium">نشر الصفحة للزوار</span>
        </label>

        <div>
          <h2 className="font-semibold mb-2">Blocks JSON</h2>
          <p className="text-sm text-muted-foreground mb-4">الأنواع المدعومة: hero, pricing, text, cta.</p>
          <textarea
            className="w-full h-[500px] p-4 font-mono text-sm bg-black text-green-400 rounded-lg border-none focus:ring-2 focus:ring-primary outline-none"
            value={blocksJson}
            onChange={(event) => setBlocksJson(event.target.value)}
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
}
