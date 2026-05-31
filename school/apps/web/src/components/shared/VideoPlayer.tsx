"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface VideoPlayerProps {
  lessonId: string;
  playbackUrl: string;
  viewerEmail?: string;
  initialCompleted?: boolean;
}

export function VideoPlayer({ lessonId, playbackUrl, viewerEmail = "student@school.com", initialCompleted = false }: VideoPlayerProps) {
  const [watermarkPos, setWatermarkPos] = useState({ top: "10%", left: "10%" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(initialCompleted);
  
  const lastSyncRef = useRef(0);

  // Dynamic Waterproof: randomizes position every 5 seconds to prevent static blurring/cropping
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 80) + 10}%`,
        left: `${Math.floor(Math.random() * 80) + 10}%`,
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const syncProgress = useCallback(async (seconds: number, isCompleted: boolean) => {
    try {
      await apiClient(`/api/video/${lessonId}/progress`, {
        method: "PUT",
        body: JSON.stringify({ secondsWatched: seconds, isCompleted }),
      });
    } catch {
      console.error("Failed to sync video progress");
    }
  }, [lessonId]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const currentSeconds = Math.floor(video.currentTime);
    const duration = video.duration || 1;
    const progressPercent = currentSeconds / duration;

    let shouldMarkCompleted = completed;
    
    // Automatically mark as completed if the user watches past 90% of the video length
    if (!completed && progressPercent >= 0.9) {
      setCompleted(true);
      shouldMarkCompleted = true;
      toast.success("Lesson marked as completed!");
    }

    // Debounce sync: only send updates to the server every 10 seconds
    if (Math.abs(currentSeconds - lastSyncRef.current) >= 10 || shouldMarkCompleted !== completed) {
      lastSyncRef.current = currentSeconds;
      void syncProgress(currentSeconds, shouldMarkCompleted);
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-black rounded-xl aspect-video group shadow-lg">
      <video 
        ref={videoRef}
        src={playbackUrl} 
        controls 
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Absolute floating watermark containing viewer identity */}
      <div 
        className="pointer-events-none absolute z-50 text-white/50 font-mono text-sm sm:text-base select-none transition-all duration-1000"
        style={{ top: watermarkPos.top, left: watermarkPos.left }}
      >
        {viewerEmail}
      </div>
    </div>
  );
}