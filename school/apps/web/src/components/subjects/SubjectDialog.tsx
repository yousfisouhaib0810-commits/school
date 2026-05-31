"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import * as z from "zod";
import { subjectSchema } from "@school/shared";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type SubjectFormInput = z.input<typeof subjectSchema>;
type SubjectFormValues = z.output<typeof subjectSchema>;

export function SubjectDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((state) => state.accessToken) ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormInput, unknown, SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      color: "#3B82F6",
      title: "",
    },
  });

  const onSubmit: SubmitHandler<SubjectFormValues> = async (data) => {
    setError(null);
    const res = await apiClient("/api/subjects", {
      method: "POST",
      token,
      body: JSON.stringify(data),
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
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-xl font-bold">مادة جديدة</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium">اسم المادة</label>
            <input
              {...register("title")}
              className="w-full rounded-lg border border-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="مثال: الرياضيات"
            />
            {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">لون المادة</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                {...register("color")}
                className="h-12 w-12 cursor-pointer rounded border border-border bg-white p-1"
              />
              <span className="text-sm text-muted-foreground" dir="ltr">
                #RRGGBB
              </span>
            </div>
            {errors.color && <p className="mt-1 text-sm text-destructive">{errors.color.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ المادة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
