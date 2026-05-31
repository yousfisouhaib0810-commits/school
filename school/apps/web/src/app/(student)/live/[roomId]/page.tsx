"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import ZoomMeetingViewer from "@/components/shared/ZoomMeetingViewer";

const liveParamsSchema = z.object({
  roomId: z.string().uuid(),
});

const liveSignatureSchema = z.object({
  zoomMeetingId: z.string().min(1),
  zoomPassword: z.string(),
  signature: z.string().min(1),
  sdkKey: z.string().min(1),
});

export default function StudentLiveRoomPage() {
  const params = useParams();
  const parsedParams = liveParamsSchema.safeParse(params);
  const roomId = parsedParams.success ? parsedParams.data.roomId : "";
  const [sessionData, setSessionData] = useState<z.infer<typeof liveSignatureSchema> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSignature() {
      try {
        const res = await apiClient<z.infer<typeof liveSignatureSchema>>(`/api/live/${roomId}/signature`, {
           parse: (raw: unknown) => liveSignatureSchema.parse(raw),
        });

        if (res.error) {
           setError(res.error);
           return;
        }

        setSessionData(res.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "فشل تحميل بيانات الحصة المباشرة.");
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
        <p className="text-muted-foreground">جاري تحميل الحصة المباشرة الآمنة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-white mb-6">الحصة المباشرة</h1>
      <ZoomMeetingViewer
        meetingNumber={sessionData.zoomMeetingId}
        password={sessionData.zoomPassword}
        signature={sessionData.signature}
        sdkKey={sessionData.sdkKey}
        userName="Student"
        userEmail="student@example.com"
      />
    </div>
  );
}
