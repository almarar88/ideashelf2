"use client";

import { useEffect, useRef, useState } from "react";
import AppHost from "./AppHost";
import Consent from "./Consent";
import ContextMenu from "./ContextMenu";
import Switcher from "./Switcher";
import { KernelProvider, useNova } from "./kernel-context";
import { BootScreen, Dock, IntentBar, LockScreen, NotifCenter, TopBar, Toasts } from "./Shell";
import WindowFrame from "./WindowFrame";

/**
 * NOVA OS — الجذر
 *
 * الفكرة التي يقوم عليها كل ما تحت هذا الملف:
 * في نظام تقليدي، الذكاء الاصطناعي ملحق داخل تطبيق. في نوفا، الذكاء هو
 * المُخطِّط الذي يقود *النظام*، لكنه لا يملك إلا نداءات النظام التي يملكها
 * المستخدم نفسه. لذلك: قدرة بلا صلاحيات مفتوحة، وسجل كامل بلا استثناء.
 */
export default function NovaOS({
  neural,
  model,
  identity,
}: {
  neural: boolean;
  model: string;
  identity: { name: string; handle: string; role: string };
}) {
  return (
    <KernelProvider neural={neural} model={model} identity={identity}>
      <Desktop />
    </KernelProvider>
  );
}

function Desktop() {
  const { state, run, deskRef, neural, importFiles, fileInputRef, pickDirRef } = useNova();
  const [intent, setIntent] = useState(false);
  const [bell, setBell] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [switching, setSwitching] = useState<number | null>(null);
  // مؤشر المبدّل يعيش في مرجع لا في مُحدِّث حالة: تنفيذ نداء نظام داخل
  // مُحدِّث setState يعني تعديل مكوّن أثناء تصيير آخر — وهو خطأ فعلي في React.
  const switchIdx = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // ── اختصارات النظام
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const inField = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName ?? "");

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCtx(null);
        setIntent((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setIntent(false);
        setBell(false);
        setCtx(null);
        return;
      }
      if (!mod) return;

      // تبديل النوافذ: الحلقة تتقدّم مع كل ضغطة، والإفلات يُركّز المختار
      if (e.key === "`" || e.code === "Backquote") {
        e.preventDefault();
        switchIdx.current = (switchIdx.current ?? 0) + 1;
        setSwitching(switchIdx.current);
        return;
      }
      if (e.key.toLowerCase() === "j" && !inField) {
        e.preventDefault();
        run({ op: "win.arrange", args: { mode: "grid" } });
      }
      if (e.key === "ArrowLeft" && !inField) {
        e.preventDefault();
        run({ op: "win.arrange", args: { mode: "split" } });
      }
      if (e.key.toLowerCase() === "l" && e.shiftKey) {
        e.preventDefault();
        run({ op: "power", args: { action: "lock" } });
      }
      // Ctrl+رقم ينتقل بين الأسطح، ومع Shift ينقل النافذة النشطة إليها
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const index = Number(e.key);
        run(e.shiftKey ? { op: "space.send", args: { index } } : { op: "space.switch", args: { index } });
        return;
      }
      if (e.key.toLowerCase() === "w" && !inField) {
        e.preventDefault();
        run({ op: "win.close", args: {} });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Control" && e.key !== "Meta") return;
      const idx = switchIdx.current;
      if (idx === null) return;
      switchIdx.current = null;
      setSwitching(null);
      const order = [...state.windows].sort((a, b) => b.z - a.z);
      const pick = order[idx % Math.max(1, order.length)];
      if (pick) run({ op: "win.focus", args: { id: pick.id } });
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [run, state.windows]);

  const ordered = state.windows.filter((w) => w.space === state.space).sort((a, b) => a.z - b.z);

  return (
    <div
      className="nova"
      data-mode={state.theme.mode}
      data-wall={state.theme.wallpaper}
      data-motion={state.theme.motion ? "on" : "off"}
      style={
        {
          "--accent": state.theme.accent,
          "--panel-a": state.theme.mode === "night" ? 0.055 + state.theme.glass * 0.06 : 0.35 + state.theme.glass * 0.35,
        } as React.CSSProperties
      }
    >
      <div className="nova-wall" />

      {state.phase === "boot" && <BootScreen neural={neural} />}
      {state.phase === "locked" && <LockScreen />}

      {state.phase === "live" && (
        <>
          <TopBar onIntent={() => setIntent(true)} onBell={() => setBell((v) => !v)} />

          <div
            ref={deskRef}
            style={{ position: "absolute", inset: "34px 0 62px", zIndex: 1 }}
            onPointerDown={() => {
              setIntent(false);
              setBell(false);
              setCtx(null);
            }}
            onDragOver={(e) => {
              // السحب والإفلات: أبسط طريق يعرفه المستخدم لإدخال ملف إلى نظام
              e.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer?.files?.length) void importFiles(e.dataTransfer.files);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIntent(false);
              setCtx({ x: e.clientX, y: e.clientY });
            }}
            onDoubleClick={(e) => {
              if (e.target === e.currentTarget) setIntent(true);
            }}
          >
            {ordered.length === 0 && (
              <div className="empty" style={{ height: "100%", pointerEvents: "none" }}>
                <div style={{ fontSize: 34, letterSpacing: 10 }} className="accent">
                  NOVA
                </div>
                <div style={{ fontSize: 15 }}>اضغط Ctrl + K وقل ما تريد</div>
                <div className="faint" style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.8 }}>
                  لا حاجة لتتعلّم مكان أي شيء. النظام يفهم النية ويحوّلها إلى نداءات
                  مُسجّلة يمكنك الرجوع عنها كلها من «الخط الزمني».
                </div>
              </div>
            )}

            {dragging && (
              <div className="drop-veil">
                <div className="drop-card glass">
                  <div style={{ fontSize: 30 }}>⤓</div>
                  <div style={{ fontWeight: 600 }}>أفلت الملفات لاستيرادها</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    نصوص وصور حتى 3 م.ب للملف · تُحفظ في /بيتي/مستورد
                  </div>
                </div>
              </div>
            )}

            {ordered.map((w) => (
              <WindowFrame key={w.id} win={w}>
                <AppHost win={w} />
              </WindowFrame>
            ))}
          </div>

          <Consent />
          {ctx && <ContextMenu x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} />}
          {switching !== null && <Switcher index={switching} />}
          {intent && <IntentBar onClose={() => setIntent(false)} />}
          {bell && <NotifCenter onClose={() => setBell(false)} />}
          <Toasts />
          <Dock onIntent={() => setIntent((v) => !v)} />

          {/* منتقي ملفات النظام: يفتحه نداء fs.import ولا يُرى إلا لحظة الاختيار */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void importFiles(files, pickDirRef.current ?? undefined);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
