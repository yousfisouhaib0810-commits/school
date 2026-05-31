"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface LessonDetails {
  id: string;
  title: string;
  description: string | null;
  videoUid: string | null;
  sortOrder: number;
}

export default function CoursesPage() {
  const [lessons, setLessons] = useState<LessonDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await apiClient<LessonDetails[]>("/api/video", {
          parse: (raw: unknown) => raw as LessonDetails[],
        });
        if (res.error) throw new Error(res.error);
        setLessons(res.data || []);
      } catch {
        toast.error("Failed to load courses");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex p-12 justify-center col-span-full min-h-[300px] items-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Courses</h1>
        <p className="text-muted-foreground">Continue learning where you left off.</p>
      </div>

      <div className="grid gap-4">
        {lessons.length === 0 ? (
          <div className="p-12 text-center bg-muted/40 border border-dashed rounded-lg text-muted-foreground">
            No courses are currently available in this campus.
          </div>
        ) : (
          lessons.map((lesson) => (
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
                  <Button variant="secondary" className="w-full sm:w-auto">Start Lesson</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}