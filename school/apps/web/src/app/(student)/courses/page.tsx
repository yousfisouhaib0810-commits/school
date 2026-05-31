"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { StudentEmptyState, StudentErrorState, StudentLoadingState } from "@/components/student/StudentStates";

interface LessonDetails {
  id: string;
  title: string;
  description: string | null;
  videoUid: string | null;
  sortOrder: number;
}

const lessonsResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    videoUid: z.string().nullable(),
    sortOrder: z.number().int(),
  })
);

export default function CoursesPage() {
  const [lessons, setLessons] = useState<LessonDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient<LessonDetails[]>("/api/video", {
        parse: (raw: unknown) => lessonsResponseSchema.parse(raw),
      });
      if (response.error) {
        throw new Error(response.error);
      }
      setLessons(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الدروس.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <StudentLoadingState title="جاري تحميل الدروس" description="نجهز قائمة الدروس المتاحة لهذا الحساب." />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">دروسي</h1>
        <p className="text-muted-foreground">تابع التعلم من آخر نقطة وصلت إليها.</p>
      </div>

      {error && (
        <StudentErrorState
          title="تعذر تحميل الدروس"
          description={error}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadData()}
        />
      )}

      <div className="grid gap-4">
        {!error && lessons.length === 0 ? (
          <StudentEmptyState title="لا توجد دروس منشورة" description="ستظهر هنا الدروس بعد أن يضيفها الأستاذ وينشر محتوى الفيديو." />
        ) : (
          !error && lessons.map((lesson) => (
            <div key={lesson.id} className="flex flex-col sm:flex-row border rounded-xl p-4 bg-card items-start sm:items-center justify-between shadow-sm transition hover:shadow-md gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex shrink-0 items-center justify-center text-primary">
                  <PlayCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{lesson.title}</h3>
                  {lesson.description && <p className="text-sm text-muted-foreground line-clamp-1">{lesson.description}</p>}
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <Link href={`/courses/lesson/${lesson.id}`}>
                  <Button variant="secondary" className="w-full sm:w-auto">بدء الدرس</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
