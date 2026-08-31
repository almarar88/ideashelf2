"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export type UploadedImage = { url: string; base64?: string };

export function ImageUploader({
  images,
  onChange,
  multiple = true,
  label = "إضافة صور",
}: {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "فشل الرفع");
        }
        const data = await res.json();
        uploaded.push({ url: data.url, base64: data.base64 });
      }
      onChange(multiple ? [...images, ...uploaded] : uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((img, idx) => (
          <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border)]">
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-xs text-gray-400 hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <span className="text-xl">{uploading ? "⏳" : "📷"}</span>
          <span>{label}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
