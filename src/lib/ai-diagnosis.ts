import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { PALM_DISEASE_KB } from "@/lib/palm-diseases-kb";

export type DiagnosisResult = {
  diseaseName: string;
  confidence: number;
  severity: string;
  symptoms: string;
  treatment: string;
  prevention: string;
  aiRaw: string;
  source: "ai" | "mock";
};

const SYSTEM_PROMPT = `أنت خبير زراعي متخصص في أمراض وآفات نخيل التمر. ستُعطى صورة لسعف أو جذع أو ثمار نخلة.
حلل الصورة وحدد إن كانت هناك إصابة مرضية أو حشرية أو نقص غذائي، ثم أجب حصريًا بصيغة JSON صالحة بدون أي نص إضافي بالمخطط التالي:
{
  "diseaseName": "اسم المرض أو الآفة بالعربية أو 'سليمة' إن لم توجد إصابة",
  "confidence": رقم بين 0 و 1 يمثل مدى الثقة,
  "severity": "منخفضة" أو "متوسطة" أو "عالية",
  "symptoms": "وصف الأعراض الظاهرة في الصورة",
  "treatment": "خطوات العلاج الموصى بها بالتفصيل",
  "prevention": "نصائح للوقاية مستقبلًا"
}`;

export async function diagnosePalmImage(base64DataUrl: string, notes?: string): Promise<DiagnosisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const match = base64DataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!match) throw new Error("صيغة الصورة غير صالحة");
      const [, mediaType, base64Data] = match;

      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: notes
                  ? `ملاحظات إضافية من المزارع: ${notes}`
                  : "حلل هذه الصورة لنخلة التمر وأعطني التشخيص بصيغة JSON كما هو محدد.",
              },
            ],
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("تعذر تحليل استجابة الذكاء الاصطناعي");
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        diseaseName: parsed.diseaseName || "غير محدد",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        severity: parsed.severity || "متوسطة",
        symptoms: parsed.symptoms || "",
        treatment: parsed.treatment || "",
        prevention: parsed.prevention || "",
        aiRaw: raw,
        source: "ai",
      };
    } catch (err) {
      console.error("AI diagnosis failed, falling back to mock analyzer:", err);
      return mockDiagnose(base64DataUrl, notes);
    }
  }

  return mockDiagnose(base64DataUrl, notes);
}

function mockDiagnose(base64DataUrl: string, notes?: string): DiagnosisResult {
  const hash = createHash("sha256").update(base64DataUrl.slice(0, 5000)).digest("hex");
  const seed = parseInt(hash.slice(0, 8), 16);
  const idx = seed % PALM_DISEASE_KB.length;
  const disease = PALM_DISEASE_KB[idx];
  const confidence = 0.55 + (seed % 30) / 100;

  return {
    diseaseName: disease.arabicName,
    confidence: Math.min(confidence, 0.92),
    severity: disease.severity,
    symptoms: disease.symptoms,
    treatment: disease.treatment,
    prevention: disease.prevention,
    aiRaw: `[وضع تجريبي بدون مفتاح Anthropic API — هذا تحليل تقديري وليس تشخيصًا طبيًا دقيقًا]${
      notes ? ` ملاحظات المستخدم: ${notes}` : ""
    }`,
    source: "mock",
  };
}
