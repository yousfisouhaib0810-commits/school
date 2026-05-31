"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LessonDetails {
  id: string;
  title: string;
  description: string | null;
  videoUid: string | null;
}

interface PlaybackTokenResponse {
  token: string;
  url: string;
}

interface ProgressResponse {
  secondsWatched: number;
  isCompleted: boolean;
}

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
        // Find the lesson details from the master list (filtered securely on the API level mapping to Tenant)
        const lessonsRes = await apiClient<LessonDetails[]>("/api/video", {
          parse: (raw: unknown) => raw as LessonDetails[]
        });

        if (lessonsRes.error || !lessonsRes.data) {
          throw new Error("Failed to load lesson");
        }

        const foundLesson = lessonsRes.data.find(l => l.id === lessonId);
        if (!foundLesson) {
           throw new Error("Lesson not found");
        }

        setLesson(foundLesson);

        // Fetch completion progress to populate the boolean flag.
        const progressRes = await apiClient<ProgressResponse>(`/api/video/${lessonId}/progress`, {
           parse: (raw: unknown) => raw as ProgressResponse
        });
        if (!progressRes.error && progressRes.data) {
           setInitialProgress(progressRes.data);
        }

        // If video is assigned, query Cloudflare (or mock API endpoint) to retrieve the DRM token.
        if (foundLesson.videoUid) {
           const tokenRes = await apiClient<PlaybackTokenResponse>(`/api/video/${foundLesson.videoUid}/playback-token`, {
             parse: (raw: unknown) => raw as PlaybackTokenResponse
           });
           
           if (tokenRes.data?.url) {
              setPlaybackUrl(tokenRes.data.url);
           }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error loading lesson data.");
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
        <h2 className="text-xl font-bold mb-4">Lesson not found.</h2>
        <Link href="/courses">
           <Button variant="outline">Return to Courses</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/courses" className="text-primary hover:underline text-sm font-medium mb-4 inline-block">
          &larr; Back to Courses
        </Link>
        <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
        {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
      </div>

      {!lesson.videoUid ? (
        <div className="bg-muted px-12 py-24 text-center rounded-xl border border-dashed border-muted-foreground/30">
          <p className="text-muted-foreground">No video has been assigned to this lesson yet.</p>
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
          <p className="font-semibold text-lg">Failed to acquire secure playback token.</p>
          <p className="text-sm mt-2 opacity-80">This video might be deactivated or your subscription has expired.</p>
        </div>
      )}
    </div>
  );
}