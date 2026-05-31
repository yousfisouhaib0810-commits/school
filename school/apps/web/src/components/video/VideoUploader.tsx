"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle, FileVideo, UploadCloud } from "lucide-react";
import { z } from "zod";
import {
  ALLOWED_VIDEO_MIME_TYPES,
  VIDEO_UPLOAD_MAX_BYTES,
  videoUploadRequestSchema,
} from "@school/shared";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const uploadUrlResponseSchema = z.object({
  uploadURL: z.string().url(),
  uid: z.string().min(1),
});

const maxVideoSizeGb = Math.floor(VIDEO_UPLOAD_MAX_BYTES / 1024 / 1024 / 1024);

export function VideoUploader({
  lessonId,
  onUploadSuccess,
}: {
  lessonId: string;
  onUploadSuccess: (uid: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((state) => state.accessToken) ?? undefined;

  const validateSelectedFile = (selectedFile: File) =>
    videoUploadRequestSchema.safeParse({
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      mimeType: selectedFile.type,
    });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    const validation = validateSelectedFile(selectedFile);
    if (!validation.success) {
      setFile(null);
      setError(`اختر ملف فيديو بصيغة MP4 أو WebM أو MOV وبحجم لا يتجاوز ${maxVideoSizeGb}GB.`);
      return;
    }

    setFile(selectedFile);
    setProgress(0);
    setError(null);
  };

  const assignVideoToLesson = async (uid: string) => {
    const res = await apiClient("/api/video/assign", {
      method: "PATCH",
      token,
      body: JSON.stringify({ lessonId, videoUid: uid }),
    });

    if (res.error) {
      setUploading(false);
      setError(res.error || "تم الرفع لكن فشل ربط الفيديو بالدرس");
      return;
    }

    setUploading(false);
    setFile(null);
    setProgress(100);
    onUploadSuccess(uid);
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
      const uploadRequest = videoUploadRequestSchema.parse({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      const { data, error: apiError } = await apiClient<{ uploadURL: string; uid: string }>("/api/video/upload-url", {
        method: "POST",
        token,
        body: JSON.stringify(uploadRequest),
        parse: (raw: unknown) => uploadUrlResponseSchema.parse(raw),
      });

      if (apiError || !data) {
        throw new Error(apiError ?? "فشل في الحصول على رابط الرفع");
      }

      if (data.uploadURL === "https://mock.cloudflare.stream/upload") {
        setTimeout(() => {
          setProgress(100);
          void assignVideoToLesson(data.uid);
        }, 1500);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          void assignVideoToLesson(data.uid);
          return;
        }

        setUploading(false);
        setError("حدث خطأ أثناء رفع الملف إلى Cloudflare");
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
      setError(err instanceof Error ? err.message || "حدث خطأ غير متوقع" : "حدث خطأ غير متوقع");
    }
  };

  return (
    <div className="border border-border rounded-xl p-6 bg-white shadow-sm flex items-start gap-4">
      <button
        type="button"
        className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        aria-label="اختيار ملف فيديو"
      >
        <UploadCloud className="w-8 h-8" />
        <input
          type="file"
          accept={ALLOWED_VIDEO_MIME_TYPES.join(",")}
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={uploading}
        />
      </button>

      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground">رفع فيديو جديد</h4>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          يقبل النظام ملفات MP4 أو WebM أو MOV حتى {maxVideoSizeGb}GB.
        </p>

        {file && !uploading && progress !== 100 && (
          <div className="flex items-center gap-3 bg-muted p-2 rounded-lg">
            <FileVideo className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm flex-1 font-medium truncate">{file.name}</span>
            <button
              type="button"
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
            <span>تم رفع الفيديو وربطه بنجاح.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded-lg text-sm mt-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
