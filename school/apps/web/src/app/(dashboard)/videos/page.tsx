"use client";

import { useState } from "react";
import { VideoUploader } from "@/components/video/VideoUploader";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Shield, Info } from "lucide-react";

export default function VideosPage() {
  const [vidId, setVidId] = useState<string | null>(null);
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إدارة الفيديو المحمي (DRM)</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            نظام الرفع والتشغيل باستخدام Cloudflare Stream مع علامات مائية ديناميكية.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="block mb-1">ملاحظة البيئة التطويرية (Dev Mode):</strong>
          إذا لم تكن متغيرات <code className="bg-amber-100 px-1 rounded">CLOUDFLARE_ACCOUNT_ID</code> متوفرة في الخادم، 
          سيعمل هذا المكون بوضع التشغيل الوهمي (Mock Mode) للحفاظ على بنية النظام وسهولة اختبار واجهة برمجة التطبيقات بدون تكاليف.
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg">1. ارفع فيديو</h3>
        <VideoUploader 
          lessonId="00000000-0000-0000-0000-000000000000" // Mock lesson UUID
          onUploadSuccess={(uid) => setVidId(uid)} 
        />
      </div>

      {vidId && (
        <div className="space-y-4 pt-8 border-t border-border mt-8">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">2. معاينة المشغل (مع العلامة المائية)</h3>
            <span className="text-xs font-mono bg-black text-amber-400 px-2 py-1 rounded">
              UID: {vidId}
            </span>
          </div>
          <VideoPlayer uid={vidId} />
        </div>
      )}
    </div>
  );
}