"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import ZoomMeetingViewer from "@/components/shared/ZoomMeetingViewer";

export default function StudentLiveRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [sessionData, setSessionData] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSignature() {
      try {
        const res = await apiClient<Record<string, string>>(`/api/live/${roomId}/signature`, {
           parse: (raw: unknown) => raw as Record<string, string>,
        });

        if (res.error) {
           setError(res.error);
           return;
        }

        setSessionData(res.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load live session details.");
      }
    }

    if (roomId) {
      void loadSignature();
    }
  }, [roomId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive font-medium">{error}</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading secure live session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-white mb-6">Live Session</h1>
      <ZoomMeetingViewer
        meetingNumber={sessionData.zoomMeetingId}
        password={sessionData.zoomPassword}
        signature={sessionData.signature}
        sdkKey={sessionData.sdkKey}
        userName="Student" // Should be fetched from auth context
        userEmail="student@example.com" // Should be fetched from auth context
      />
    </div>
  );
}
