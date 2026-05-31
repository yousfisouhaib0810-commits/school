"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle, FileVideo, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export function VideoUploader({ 
  lessonId, 
  onUploadSuccess 
}: { 
  lessonId: string; 
  onUploadSuccess: (uid: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("الرجاء اختيار ملف أولاً");
      return;
    }
    
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get Cloudflare direct upload URL
      const { data, error: apiError } = await apiClient<{ uploadURL: string; uid: string }>("/api/video/upload-url", {
        method: "POST",
        token,
        parse: (d: unknown) => d as { uploadURL: string; uid: string },
      });

      if (apiError || !data) {
        throw new Error(apiError ?? "فشل في الحصول على رابط الرفع");
      }

      // If it's a mock upload URL for local dev
      if (data.uploadURL === "https://mock.cloudflare.stream/upload") {
        setTimeout(async () => {
          setProgress(100);
          await assignVideoToLesson(data.uid);
        }, 1500);
        return;
      }

      // 2. Upload file directly to Cloudflare via XMLHttpRequest for progress events
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          await assignVideoToLesson(data.uid);
        } else {
          setUploading(false);
          setError("خطأ في رفع الملف لـ Cloudflare");
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        setError("فشل الاتصال بالخادم أثناء الرفع");
      };

      const formData = new FormData();
      formData.append("file", file);

      xhr.open("POST", data.uploadURL, true);
      xhr.send(formData);

    } catch (err: unknown) {
      setUploading(false);
      if (err instanceof Error) {
        setError(err.message || "حدث خطأ غير متوقع");
      } else {
        setError("حدث خطأ غير متوقع");
      }
    }
  };

  const assignVideoToLesson = async (uid: string) => {
    const res = await apiClient("/api/video/assign", {
      method: "PATCH",
      token,
      body: JSON.stringify({ lessonId, videoUid: uid }),
    });

    if (res.error) {
      setUploading(false);
      setError(res.error || "الرفع نجح ولكن فشل ربطه بالدرس");
    } else {
      setUploading(false);
      setFile(null);
      setProgress(100);
      onUploadSuccess(uid);
    }
  };

  return (
    <div className="border border-border rounded-xl p-6 bg-white shadow-sm flex items-start gap-4">
      <div 
        className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-8 h-8" />
        <input 
          type="file" 
          accept="video/mp4,video/x-m4v,video/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      <div className="flex-1">
        <h4 className="font-bold text-foreground">رفع فيديو جديد</h4>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          يجب أن يكون الملف بصيغة MP4 وبحجم لا يتجاوز 2GB.
        </p>
        
        {file && !uploading && progress !== 100 && (
          <div className="flex items-center gap-3 bg-muted p-2 rounded-lg">
            <FileVideo className="w-5 h-5 text-primary" />
            <span className="text-sm flex-1 font-medium">{file.name}</span>
            <button 
              onClick={handleUpload}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm cursor-pointer hover:bg-primary/90"
            >
              بدء الرفع
            </button>
          </div>
        )}

        {uploading && (
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm font-medium">
              <span>جاري الرفع...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!uploading && progress === 100 && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded-lg text-sm font-medium mt-2">
            <CheckCircle className="w-5 h-5" />
            <span>تم رفع الفيديو وربطه بنجاح!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded-lg text-sm mt-3">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}