"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Card, Textarea, Badge } from "@/components/ui";

type Result = {
  diseaseName: string;
  confidence: number;
  severity: string;
  symptoms: string;
  treatment: string;
  prevention: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  "منخفضة": "#16a34a",
  "متوسطة": "#f59e0b",
  "عالية": "#dc2626",
};

export function DiseaseDetector({ palmId }: { palmId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [source, setSource] = useState<"ai" | "mock" | null>(null);
  const [error, setError] = useState("");

  async function analyze(file: File) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("فشل رفع الصورة");
      const uploaded = await uploadRes.json();
      setPreview(uploaded.url);

      let photoId: string | undefined;
      if (palmId) {
        const photoRes = await fetch(`/api/palms/${palmId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: uploaded.url, caption: "صورة تشخيص" }),
        });
        if (photoRes.ok) {
          const photo = await photoRes.json();
          photoId = photo.id;
        }
      }

      const diagRes = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palmId, photoId, imageBase64: uploaded.base64, notes }),
      });
      if (!diagRes.ok) throw new Error("فشل التحليل");
      const data = await diagRes.json();
      setResult(data.result);
      setSource(data.source);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء التحليل");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-bold">🤖 كشف الأمراض بالذكاء الاصطناعي</h2>
      <p className="mb-4 text-sm text-gray-500">
        التقط أو ارفع صورة واضحة للسعف أو الجذع أو الثمار المصابة، وسيقوم النظام بتحليلها واقتراح طريقة العلاج المناسبة.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div
            onClick={() => inputRef.current?.click()}
            className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--primary)]"
          >
            {preview ? (
              <div className="relative h-full w-full">
                <Image src={preview} alt="preview" fill className="object-cover" />
              </div>
            ) : (
              <>
                <span className="text-4xl">📷</span>
                <span className="text-sm text-gray-400">اضغط لرفع صورة</span>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])}
          />
          <Textarea
            className="mt-3"
            rows={2}
            placeholder="ملاحظات إضافية (اختياري): متى بدأت الأعراض؟ هل تنتشر لنخيل أخرى؟"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button className="mt-2 w-full" onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? "جارٍ التحليل..." : preview ? "رفع صورة أخرى" : "رفع صورة للتحليل"}
          </Button>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        <div>
          {loading && (
            <div className="flex h-full items-center justify-center text-gray-400">
              <span className="animate-pulse">جارٍ تحليل الصورة بالذكاء الاصطناعي...</span>
            </div>
          )}
          {result && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{result.diseaseName}</h3>
                <Badge color={SEVERITY_COLOR[result.severity] ?? "#64748b"}>{result.severity}</Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full bg-[var(--primary)]"
                  style={{ width: `${Math.round(result.confidence * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                نسبة الثقة: {Math.round(result.confidence * 100)}%
                {source === "mock" && " — وضع تجريبي (لم يتم ضبط مفتاح Anthropic API)"}
              </p>
              <div>
                <div className="text-sm font-semibold">الأعراض الملاحظة</div>
                <p className="text-sm text-gray-500">{result.symptoms}</p>
              </div>
              <div>
                <div className="text-sm font-semibold">طريقة العلاج المقترحة</div>
                <p className="text-sm text-gray-500">{result.treatment}</p>
              </div>
              <div>
                <div className="text-sm font-semibold">نصائح للوقاية</div>
                <p className="text-sm text-gray-500">{result.prevention}</p>
              </div>
            </div>
          )}
          {!result && !loading && (
            <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
              ستظهر نتيجة التحليل هنا
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
