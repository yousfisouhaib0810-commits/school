"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { z } from "zod";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { StudentEmptyState, StudentErrorState, StudentLoadingState } from "@/components/student/StudentStates";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

const routeParamsSchema = z.object({
  lessonId: z.string().uuid(),
});

const lessonDetailsSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  videoUid: z.string().nullable(),
});

const lessonsResponseSchema = z.array(lessonDetailsSchema);

const playbackTokenResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
});

const progressResponseSchema = z.object({
  secondsWatched: z.number().int().min(0),
  isCompleted: z.boolean(),
});

type LessonDetails = z.infer<typeof lessonDetailsSchema>;
type ProgressResponse = z.infer<typeof progressResponseSchema>;

export default function LessonPage() {
  const params = useParams();
  const parsedParams = routeParamsSchema.safeParse(params);
  const lessonId = parsedParams.success ? parsedParams.data.lessonId : "";

  const [lesson, setLesson] = useState<LessonDetails | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [initialProgress, setInitialProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(parsedParams.success ? null : "رابط الدرس غير صالح.");

  const fetchLessonAndToken = useCallback(async () => {
    if (!lessonId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPlaybackUrl(null);

    try {
      const lessonsResponse = await apiClient<LessonDetails[]>("/api/video", {
        parse: (raw: unknown) => lessonsResponseSchema.parse(raw),
      });

      if (lessonsResponse.error || !lessonsResponse.data) {
        throw new Error(lessonsResponse.error ?? "تعذر تحميل قائمة الدروس.");
      }

      const foundLesson = lessonsResponse.data.find((item) => item.id === lessonId);
      if (!foundLesson) {
        setLesson(null);
        return;
      }

      setLesson(foundLesson);

      const progressResponse = await apiClient<ProgressResponse>(`/api/video/${lessonId}/progress`, {
        parse: (raw: unknown) => progressResponseSchema.parse(raw),
      });
      if (!progressResponse.error && progressResponse.data) {
        setInitialProgress(progressResponse.data);
      }

      if (foundLesson.videoUid) {
        const tokenResponse = await apiClient<z.infer<typeof playbackTokenResponseSchema>>(
          `/api/video/${foundLesson.videoUid}/playback-token`,
          { parse: (raw: unknown) => playbackTokenResponseSchema.parse(raw) }
        );

        if (tokenResponse.error) {
          throw new Error(tokenResponse.error);
        }

        if (tokenResponse.data?.url) {
          setPlaybackUrl(tokenResponse.data.url);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الدرس.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchLessonAndToken();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchLessonAndToken]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <StudentLoadingState title="جاري تحميل الدرس" description="نراجع صلاحية الوصول ونجهز رابط الفيديو الآمن." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <StudentErrorState
          title="تعذر فتح الدرس"
          description={error}
          actionLabel="إعادة المحاولة"
          onAction={() => void fetchLessonAndToken()}
        />
        <div className="mt-4 text-center">
          <Link href="/courses">
            <Button variant="outline">العودة إلى الدروس</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <StudentEmptyState title="الدرس غير موجود" description="قد يكون الدرس غير منشور أو تمت إزالته من هذه الأكاديمية." />
        <div className="mt-4 text-center">
          <Link href="/courses">
            <Button variant="outline">العودة إلى الدروس</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <Link href="/courses" className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
          العودة إلى الدروس
        </Link>
        <h1 className="mb-2 text-3xl font-bold">{lesson.title}</h1>
        {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
      </div>

      {!lesson.videoUid ? (
        <StudentEmptyState title="لا يوجد فيديو بعد" description="لم يربط الأستاذ فيديو بهذا الدرس حتى الآن." />
      ) : playbackUrl ? (
        <VideoPlayer
          lessonId={lesson.id}
          playbackUrl={playbackUrl}
          viewerEmail="student@subdomain.local"
          initialCompleted={initialProgress?.isCompleted}
        />
      ) : (
        <StudentErrorState
          title="رابط التشغيل غير متاح"
          description="قد يكون الفيديو غير مفعل أو أن الاشتراك لا يسمح بمشاهدة هذا المحتوى."
          actionLabel="إعادة المحاولة"
          onAction={() => void fetchLessonAndToken()}
        />
      )}
    </div>
  );
}
