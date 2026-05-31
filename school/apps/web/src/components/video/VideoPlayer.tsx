"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { decodeTokenPayload } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const playbackTokenResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
});

export function VideoPlayer({ uid }: { uid: string }) {
  const [watermarkPos, setWatermarkPos] = useState({ top: "10%", left: "10%" });
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const token = useAuthStore((state) => state.accessToken) ?? undefined;
  const viewerLabel = useMemo(() => {
    if (!token) {
      return "viewer-secured";
    }

    const payload = decodeTokenPayload(token);
    return payload?.sub && typeof payload.sub === "string" ? `${payload.sub.slice(0, 8)}...` : "viewer-secured";
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.random() * 80 + 10}%`,
        left: `${Math.random() * 80 + 10}%`,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchSignedUrl() {
      if (!uid) {
        return;
      }

      const res = await apiClient<{ token: string; url: string }>(`/api/video/${uid}/playback-token`, {
        token,
        parse: (raw: unknown) => playbackTokenResponseSchema.parse(raw),
      });

      if (res.error) {
        setError("غير مصرح لك بعرض هذا الفيديو");
        return;
      }

      if (res.data) {
        setPlaybackUrl(res.data.url);
      }
    }

    void fetchSignedUrl();
  }, [uid, token]);

  if (error) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg text-red-500 font-bold">
        {error}
      </div>
    );
  }

  if (uid.startsWith("mock-") || (playbackUrl && playbackUrl.includes("mock.cloudflare"))) {
    return (
      <div
        ref={containerRef}
        className="w-full aspect-video bg-black rounded-lg relative overflow-hidden flex items-center justify-center border-2 border-primary/20"
      >
        <div className="text-white/50 flex flex-col items-center">
          <p className="font-bold text-xl">Cloudflare Stream Mock</p>
          <p className="text-sm mt-2">UID: {uid}</p>
        </div>

        <div
          className="absolute text-white/30 font-mono text-sm pointer-events-none select-none transition-all duration-1000 z-50 whitespace-nowrap"
          style={{ top: watermarkPos.top, left: watermarkPos.left, textShadow: "1px 1px 2px black" }}
        >
          {viewerLabel}
          <br />
          {new Date().toLocaleDateString()}
        </div>
      </div>
    );
  }

  if (!playbackUrl) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg text-white">
        جاري تهيئة المشغل المحمي...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full aspect-video bg-black rounded-lg relative overflow-hidden shadow-md">
      <iframe
        src={playbackUrl}
        className="border-none w-full h-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        title="مشغل الفيديو"
      />

      <div
        className="absolute text-white/40 font-mono text-xs md:text-sm pointer-events-none select-none transition-all duration-[3000ms] ease-in-out z-50"
        style={{ top: watermarkPos.top, left: watermarkPos.left, textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
      >
        <div className="bg-black/20 p-1 rounded backdrop-blur-sm">
          {viewerLabel}
          <br />
          {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
