"use client";

import dynamic from "next/dynamic";

/**
 * نوفا نظام يعيش في المتصفح بالكامل: حالته في الذاكرة والتخزين المحلي، لا على الخادم.
 * لذلك نُلغي التصيير المسبق صراحةً — بذلك تقرأ النواة الجلسة المحفوظة في أول تصيير
 * دون أي تعارض ترطيب، ويبقى الإقلاع صادقًا: ما تراه هو ما في جهازك.
 */
const NovaOS = dynamic(() => import("./NovaOS"), {
  ssr: false,
  loading: () => (
    <div className="nova">
      <div className="boot">
        <div className="boot-inner">
          <div className="boot-mark">NOVA</div>
        </div>
      </div>
    </div>
  ),
});

export default function NovaClient({ neural, model }: { neural: boolean; model: string }) {
  return <NovaOS neural={neural} model={model} />;
}
