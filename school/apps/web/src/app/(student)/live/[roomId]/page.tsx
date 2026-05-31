"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { z } from "zod";
import JitsiMeetingViewer from "@/components/shared/JitsiMeetingViewer";
import { StudentErrorState, StudentLoadingState } from "@/components/student/StudentStates";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

const liveParamsSchema = z.object({
  roomId: z.string().uuid(),
});

const liveSignatureSchema = z.object({
  provider: z.literal("jitsi"),
  domain: z.string().min(1),
  roomName: z.string().min(1),
  joinUrl: z.string().url(),
  jwt: z.string().min(1),
  isModerator: z.boolean(),
});

type LiveSignature = z.infer<typeof liveSignatureSchema>;

export default function StudentLiveRoomPage() {
  const params = useParams();
  const parsedParams = liveParamsSchema.safeParse(params);
  const roomId = parsedParams.success ? parsedParams.data.roomId : "";
  const [sessionData, setSessionData] = useState<LiveSignature | null>(null);
  const [error, setError] = useState<string | null>(parsedParams.success ? null : "رابط الحصة المباشرة غير صالح.");
  const [loading, setLoading] = useState(parsedParams.success);

  const loadSignature = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient<LiveSignature>(`/api/live/${roomId}/signature`, {
        parse: (raw: unknown) => liveSignatureSchema.parse(raw),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setSessionData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل بيانات الحصة المباشرة.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSignature();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSignature]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <StudentLoadingState title="جاري تجهيز الحصة المباشرة" description="نراجع صلاحية الاشتراك ونجهز توقيع الدخول الآمن." />
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <StudentErrorState
          title="تعذر فتح الحصة المباشرة"
          description={error ?? "بيانات الحصة غير متوفرة حالياً."}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadSignature()}
        />
        <div className="mt-4 text-center">
          <Link href="/live">
            <Button variant="outline">العودة إلى الحصص</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-neutral-950 p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">الحصة المباشرة</h1>
      <JitsiMeetingViewer
        domain={sessionData.domain}
        roomName={sessionData.roomName}
        jwt={sessionData.jwt}
        userName="Student"
        userEmail="student@example.com"
      />
    </div>
  );
}
