"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
  const lessonId = params.lessonId as string;
  
  const [lesson, setLesson] = useState<LessonDetails | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [initialProgress, setInitialProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLessonAndToken() {
      try {
        const lessonsRes = await apiClient<LessonDetails[]>("/api/video", {
          parse: (raw: unknown) => lessonsResponseSchema.parse(raw)
        });

        if (lessonsRes.error || !lessonsRes.data) {
          throw new Error("فشل تحميل الدرس");
        }

        const foundLesson = lessonsRes.data.find(l => l.id === lessonId);
        if (!foundLesson) {
           throw new Error("الدرس غير موجود");
        }

        setLesson(foundLesson);

        const progressRes = await apiClient<ProgressResponse>(`/api/video/${lessonId}/progress`, {
           parse: (raw: unknown) => progressResponseSchema.parse(raw)
        });
        if (!progressRes.error && progressRes.data) {
           setInitialProgress(progressRes.data);
        }

        if (foundLesson.videoUid) {
           const tokenRes = await apiClient<z.infer<typeof playbackTokenResponseSchema>>(`/api/video/${foundLesson.videoUid}/playback-token`, {
             parse: (raw: unknown) => playbackTokenResponseSchema.parse(raw)
           });
           
           if (tokenRes.data?.url) {
              setPlaybackUrl(tokenRes.data.url);
           }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "تعذر تحميل بيانات الدرس");
      } finally {
        setLoading(false);
      }
    }

    if (lessonId) {
      void fetchLessonAndToken();
    }
  }, [lessonId]);

  if (loading) {
    return (
      <div className="flex p-12 justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground cursor-wait" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="p-12 text-center flex flex-col items-center">
        <h2 className="text-xl font-bold mb-4">الدرس غير موجود.</h2>
        <Link href="/courses">
           <Button variant="outline">العودة إلى الدروس</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/courses" className="text-primary hover:underline text-sm font-medium mb-4 inline-block">
          &larr; العودة إلى الدروس
        </Link>
        <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
        {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
      </div>

      {!lesson.videoUid ? (
        <div className="bg-muted px-12 py-24 text-center rounded-xl border border-dashed border-muted-foreground/30">
          <p className="text-muted-foreground">لم يتم ربط فيديو بهذا الدرس بعد.</p>
        </div>
      ) : playbackUrl ? (
        <VideoPlayer 
          lessonId={lesson.id} 
          playbackUrl={playbackUrl} 
          viewerEmail="student@subdomain.local" 
          initialCompleted={initialProgress?.isCompleted}
        />
      ) : (
        <div className="bg-destructive/10 text-destructive px-12 py-24 text-center rounded-xl border border-destructive">
          <p className="font-semibold text-lg">فشل الحصول على رابط التشغيل الآمن.</p>
          <p className="text-sm mt-2 opacity-80">قد يكون الفيديو غير مفعّل أو أن اشتراكك غير صالح.</p>
        </div>
      )}
    </div>
  );
}
