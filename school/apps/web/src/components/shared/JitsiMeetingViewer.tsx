"use client";

import { useEffect, useRef, useState } from "react";

interface JitsiMeetingViewerProps {
  domain: string;
  roomName: string;
  jwt: string;
  userName: string;
  userEmail: string;
}

interface JitsiExternalApiOptions {
  roomName: string;
  parentNode: HTMLDivElement;
  jwt: string;
  userInfo: {
    displayName: string;
    email: string;
  };
  configOverwrite: {
    prejoinPageEnabled: boolean;
    disableDeepLinking: boolean;
  };
  interfaceConfigOverwrite: {
    MOBILE_APP_PROMO: boolean;
  };
}

interface JitsiExternalApi {
  dispose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiExternalApiOptions) => JitsiExternalApi;
  }
}

function loadJitsiApi(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[data-jitsi-domain="${domain}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Jitsi API")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiDomain = domain;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Jitsi API")), { once: true });
    document.head.appendChild(script);
  });
}

export default function JitsiMeetingViewer({
  domain,
  roomName,
  jwt,
  userName,
  userEmail,
}: JitsiMeetingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let api: JitsiExternalApi | null = null;

    async function mountJitsi() {
      const parentNode = containerRef.current;
      if (!parentNode) {
        return;
      }

      try {
        await loadJitsiApi(domain);
        if (disposed || !window.JitsiMeetExternalAPI) {
          return;
        }

        parentNode.replaceChildren();
        api = new window.JitsiMeetExternalAPI(domain, {
          roomName,
          parentNode,
          jwt,
          userInfo: {
            displayName: userName,
            email: userEmail,
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
          },
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load Jitsi meeting");
      }
    }

    void mountJitsi();

    return () => {
      disposed = true;
      api?.dispose();
    };
  }, [domain, jwt, roomName, userEmail, userName]);

  if (loadError) {
    return (
      <div className="flex h-[600px] w-full max-w-5xl items-center justify-center rounded-lg bg-neutral-900 text-sm text-red-200">
        {loadError}
      </div>
    );
  }

  return <div className="h-[600px] w-full max-w-5xl overflow-hidden rounded-lg bg-black" ref={containerRef} />;
}
