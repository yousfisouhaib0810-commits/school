"use client";

import { useEffect, useRef } from "react";
import ZoomMtgEmbedded from "@zoom/meetingsdk/embedded";

interface ZoomMeetingViewerProps {
  meetingNumber: string;
  password?: string;
  signature: string;
  sdkKey: string;
  userName: string;
  userEmail: string;
}

export default function ZoomMeetingViewer({
  meetingNumber,
  password,
  signature,
  sdkKey,
  userName,
  userEmail,
}: ZoomMeetingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const client = ZoomMtgEmbedded.createClient();
    const meetingContainer = containerRef.current;

    if (meetingContainer && isMounted) {
      client.init({
        zoomAppRoot: meetingContainer,
        language: "en-US",
        customize: {
          video: {
            isResizable: true,
            viewSizes: { default: { width: 800, height: 600 } },
          },
        },
      }).then(() => {
        client.join({
          sdkKey: sdkKey,
          signature: signature,
          meetingNumber: meetingNumber,
          password: password || "",
          userName: userName,
          userEmail: userEmail,
        });
      }).catch((err: unknown) => {
        console.error("Zoom SDK init error", err);
      });
    }

    return () => {
      isMounted = false;
      try {
        ZoomMtgEmbedded.destroyClient();
      } catch (e) {
        console.error("Error destroying Zoom client", e);
      }
    };
  }, [meetingNumber, password, signature, sdkKey, userName, userEmail]);

  return <div className="h-[600px] w-full max-w-4xl mx-auto rounded-lg overflow-hidden bg-black" ref={containerRef} />;
}
