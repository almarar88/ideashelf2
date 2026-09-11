/**
 * الإدخال الصوتي.
 *
 * نظام تُقاد حالته بالنيّة ينبغي أن يسمعها، لا أن يشترط لوحة مفاتيح.
 * نستخدم Web Speech API لأنها الطريق الوحيد الذي لا يرفع صوتك إلى
 * خادمنا ولا يحتاج مفتاحًا — التعرّف يجري في المتصفح/عبر مزوّده.
 *
 * الدعم متفاوت بصدق: Chrome و Edge يدعمانها، وفايرفوكس لا. لذلك كل شيء
 * هنا يبدأ بكشف القدرة، والواجهة تُخفي الزر حين لا تتوفّر بدل أن تَعِد
 * بما لا يعمل.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
};

type SpeechCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  return ctor() !== null;
}

export type VoiceSession = {
  stop: () => void;
};

export type VoiceHandlers = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (reason: string) => void;
  onEnd?: () => void;
};

const REASONS: Record<string, string> = {
  "not-allowed": "المتصفح رفض الوصول إلى الميكروفون",
  "service-not-allowed": "خدمة التعرّف غير متاحة في هذا المتصفح",
  "no-speech": "لم أسمع شيئًا",
  "audio-capture": "لا يوجد ميكروفون متاح",
  network: "التعرّف على الكلام يحتاج اتصالًا",
  aborted: "أُلغي الاستماع",
};

/** يبدأ استماعًا واحدًا بالعربية ويعيد مقبضًا لإيقافه */
export function listen(handlers: VoiceHandlers, lang = "ar-SA"): VoiceSession | null {
  const Ctor = ctor();
  if (!Ctor) {
    handlers.onError("الإدخال الصوتي غير مدعوم في هذا المتصفح");
    return null;
  }

  let recognition: SpeechRecognitionLike;
  try {
    recognition = new Ctor();
  } catch {
    handlers.onError("تعذّر تشغيل التعرّف على الكلام");
    return null;
  }

  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        const finalText = text.trim();
        if (finalText) handlers.onFinal(finalText);
        return;
      }
      interim += text;
    }
    if (interim.trim()) handlers.onPartial?.(interim.trim());
  };

  recognition.onerror = (event) => {
    handlers.onError(REASONS[event.error ?? ""] ?? "تعذّر الاستماع");
  };

  recognition.onend = () => handlers.onEnd?.();

  try {
    recognition.start();
  } catch {
    handlers.onError("الاستماع يعمل بالفعل");
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* انتهى أصلًا */
      }
    },
  };
}
