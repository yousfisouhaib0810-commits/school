"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { LandingPageInput } from "@school/shared";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LandingPageAdmin() {
  const [data, setData] = useState<LandingPageInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchLanding() {
      try {
        const res = await apiClient<LandingPageInput>("/api/landing", {
          parse: (raw: unknown) => raw as LandingPageInput,
        });

        if (res.error) throw new Error(res.error);
        
        setData(res.data || {
          blocks: [
            { type: "hero", props: { title: "New Academy", bg: "#ffffff" } }
          ],
          published: false
        });
      } catch {
        toast.error("Failed to load landing page");
      } finally {
        setLoading(false);
      }
    }
    void fetchLanding();
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    
    // Quick validation before save
    try {
      const parsedJSON = typeof data.blocks === "string" ? JSON.parse(data.blocks) : data.blocks;
      
      const payload = {
         blocks: parsedJSON,
         published: data.published
      };

      const res = await apiClient("/api/landing", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);
      toast.success("Landing page updated successfully");
    } catch {
      toast.error("Failed to save changes. Make sure JSON is strictly valid.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8" /></div>;
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold mb-1">Page Builder JSON Editor</h1>
           <p className="text-muted-foreground">Manage your blocks using internal JSON schema.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <div className="space-y-6">
        <label className="flex items-center gap-3 bg-muted p-4 rounded-md border">
          <input 
            type="checkbox" 
            checked={data?.published || false} 
            onChange={(e) => setData(prev => prev ? { ...prev, published: e.target.checked } : null)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="font-medium">Publish Page (Make visible to students)</span>
        </label>

        <div>
           <h3 className="font-semibold mb-2">Blocks JSON</h3>
           <p className="text-sm text-muted-foreground mb-4">Edit the structural JSON array directly. Supported types: hero, pricing, text, cta.</p>
           <textarea 
             className="w-full h-[500px] p-4 font-mono text-sm bg-black text-green-400 rounded-lg border-none focus:ring-2 focus:ring-primary outline-none"
             value={typeof data?.blocks === "string" ? data.blocks : JSON.stringify(data?.blocks, null, 2)}
             onChange={(e) => setData(prev => prev ? { ...prev, blocks: e.target.value as unknown as LandingPageInput["blocks"] } : null)}
             spellCheck="false"
           />
        </div>
      </div>
    </div>
  );
}