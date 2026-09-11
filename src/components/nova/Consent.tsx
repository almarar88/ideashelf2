"use client";

import { CAPS, riskTone, type Capability } from "@/lib/nova/caps";
import { SYSCALLS } from "@/lib/nova/syscalls";
import { useNova } from "./kernel-context";

/**
 * حوار الموافقة.
 *
 * يظهر لحظة محاولة تطبيق مولّد استخدام قدرة لا يملكها. النداء يكون **قد
 * رُفض بالفعل** قبل ظهور هذا الحوار — لا شيء يُنفّذ في انتظار قرارك.
 * ولهذا يعرض الحوار النداء الحقيقي بوسائطه: أنت توافق على فعل معروف
 * لا على وصف مبهم.
 */
export default function Consent() {
  const { consent, decideConsent, state } = useNova();
  if (!consent) return null;

  const cap = consent.cap as Capability;
  const meta = CAPS[cap];
  const app = state.composed.find((c) => c.id === consent.app);
  const opTitle = SYSCALLS[consent.call.op as keyof typeof SYSCALLS]?.title ?? consent.call.op;

  return (
    <div className="modal-veil" onPointerDown={() => decideConsent(false)}>
      <div className="modal glass" onPointerDown={(e) => e.stopPropagation()}>
        <div className="row">
          <span className="nwin-icon" style={{ width: 30, height: 30, fontSize: 15 }}>
            {app?.icon ?? "✦"}
          </span>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{app?.name ?? consent.app}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>
              تطبيق مولّد بالذكاء الاصطناعي
            </div>
          </div>
          <span className={`chip ${riskTone(meta?.risk ?? "mid")}`}>
            {meta?.risk === "high" ? "خطورة عالية" : meta?.risk === "mid" ? "خطورة متوسطة" : "خطورة منخفضة"}
          </span>
        </div>

        <div className="hr" />

        <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
          يطلب صلاحية <b className="accent">{meta?.label ?? cap}</b> — {meta?.desc}.
        </div>

        <div className="card mono ltr" style={{ marginTop: 10 }}>
          <div className="faint" style={{ fontSize: 11, marginBottom: 4, direction: "rtl", textAlign: "right" }}>
            النداء المطلوب تنفيذه ({opTitle}):
          </div>
          {consent.call.op} {JSON.stringify(consent.call.args ?? {})}
        </div>

        <div className="faint" style={{ fontSize: 11.5, marginTop: 9, lineHeight: 1.7 }}>
          لم يُنفّذ شيء بعد. الموافقة تمنح هذه الصلاحية دائمًا لهذا التطبيق، وتنفّذ
          النداء أعلاه الآن. يمكنك سحبها لاحقًا من تطبيق «الصلاحيات».
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => decideConsent(true)}>
            اسمح ونفّذ
          </button>
          <button className="btn" onClick={() => decideConsent(false)}>
            ارفض
          </button>
          <div className="grow" />
          <span className="faint mono ltr">{consent.app}</span>
        </div>
      </div>
    </div>
  );
}
