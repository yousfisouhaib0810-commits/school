"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { subjectSchema } from "@school/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X } from "lucide-react";

type FormValues = z.infer<typeof subjectSchema>;

export function SubjectDialog({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(subjectSchema) as any,
    defaultValues: {
      color: "#3B82F6",
      title: "",
    }
  });

  const onSubmit = async (data: unknown) => {
    setError(null);
    const res = await apiClient("/api/subjects", {
      method: "POST",
      token,
      body: JSON.stringify(data),
      parse: (v) => v,
    });

    if (res.error) {
      setError(res.error);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" dir="rtl">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold">مادة جديدة</h2>
          <button onClick={onClose} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-1">اسم المادة</label>
            <input
              {...register("title")}
              className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="مثال: الرياضيات"
            />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">لون المادة</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                {...register("color")}
                className="w-12 h-12 rounded cursor-pointer p-1 bg-white border border-border"
              />
              <span className="text-sm text-muted-foreground" dir="ltr">{register("color").name}</span>
            </div>
            {errors.color && <p className="text-sm text-destructive mt-1">{errors.color.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ المادة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
