"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface VideoPlayerProps {
  lessonId: string;
  playbackUrl: string;
  viewerEmail?: string;
  initialCompleted?: boolean;
}

export function VideoPlayer({
  lessonId,
  playbackUrl,
  viewerEmail = "student@school.com",
  initialCompleted = false,
}: VideoPlayerProps) {
  const [watermarkPos, setWatermarkPos] = useState({ top: "10%", left: "10%" });
  const [completed, setCompleted] = useState(initialCompleted);

  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 80) + 10}%`,
        left: `${Math.floor(Math.random() * 80) + 10}%`,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const markCompleted = useCallback(async () => {
    const response = await apiClient(`/api/video/${lessonId}/progress`, {
      method: "PUT",
      body: JSON.stringify({ secondsWatched: 0, isCompleted: true }),
    });

    if (response.error) {
      toast.error(response.error);
      return;
    }

    setCompleted(true);
    toast.success("تم تسجيل اكتمال الدرس.");
  }, [lessonId]);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden bg-black rounded-xl aspect-video group shadow-lg">
        <iframe
          src={playbackUrl}
          className="w-full h-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title="مشغل الدرس"
        />
        <div
          className="pointer-events-none absolute z-50 text-white/50 font-mono text-sm sm:text-base select-none transition-all duration-1000"
          style={{ top: watermarkPos.top, left: watermarkPos.left }}
        >
          {viewerEmail}
        </div>
      </div>

      <div className="flex justify-end">
        {completed ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            تم إكمال الدرس
          </div>
        ) : (
          <Button type="button" onClick={() => void markCompleted()}>
            تحديد الدرس كمكتمل
          </Button>
        )}
      </div>
    </div>
  );
}
