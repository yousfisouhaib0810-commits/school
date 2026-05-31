"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Shield } from "lucide-react";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { VideoUploader } from "@/components/video/VideoUploader";

const lessonListSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    videoUid: z.string().nullable().optional(),
    stage: z.object({ title: z.string() }).nullable().optional(),
  })
);

export default function VideosPage() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lessons, setLessons] = useState<z.infer<typeof lessonListSchema>>([]);
  const [lessonError, setLessonError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLessons() {
      const response = await apiClient<z.infer<typeof lessonListSchema>>("/api/video", {
        parse: (raw: unknown) => lessonListSchema.parse(raw),
      });

      if (response.error || !response.data) {
        setLessonError(response.error ?? "فشل تحميل الدروس");
        return;
      }

      setLessons(response.data);
      setSelectedLessonId(response.data[0]?.id ?? "");
    }

    void fetchLessons();
  }, []);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إدارة الفيديو المحمي</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            رفع وتشغيل فيديوهات الدروس عبر Cloudflare Stream مع روابط موقعة وعلامة مائية ديناميكية.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-sm">
          في production يجب ضبط مفاتيح Cloudflare Stream في خدمة الـ API. بدونها سيرفض الخادم الرفع أو التشغيل بدلاً
          من استخدام روابط وهمية.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg">1. ارفع فيديو</h3>
        {lessonError && <p className="text-sm text-destructive">{lessonError}</p>}
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">الدرس المرتبط بالفيديو</span>
          <select
            value={selectedLessonId}
            onChange={(event) => setSelectedLessonId(event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            {lessons.length === 0 ? (
              <option value="">لا توجد دروس متاحة</option>
            ) : (
              lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.stage?.title ? `${lesson.stage.title} - ${lesson.title}` : lesson.title}
                </option>
              ))
            )}
          </select>
        </label>
        {selectedLessonId && (
          <VideoUploader
            lessonId={selectedLessonId}
            onUploadSuccess={(uid) => {
              setVideoId(uid);
              setLessons((currentLessons) =>
                currentLessons.map((lesson) => (lesson.id === selectedLessonId ? { ...lesson, videoUid: uid } : lesson))
              );
            }}
          />
        )}
      </div>

      {(videoId || selectedLesson?.videoUid) && (
        <div className="space-y-4 pt-8 border-t border-border mt-8">
          <div className="flex justify-between items-center gap-3">
            <h3 className="font-bold text-lg">2. معاينة المشغل المحمي</h3>
            <span className="text-xs font-mono bg-black text-amber-400 px-2 py-1 rounded truncate max-w-56">
              UID: {videoId ?? selectedLesson?.videoUid}
            </span>
          </div>
          <VideoPlayer uid={videoId ?? selectedLesson?.videoUid ?? ""} />
        </div>
      )}
    </div>
  );
}
