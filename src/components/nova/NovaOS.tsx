"use client";

import { useEffect, useState } from "react";
import AppHost from "./AppHost";
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
export default function NovaOS({ neural, model }: { neural: boolean; model: string }) {
  return (
    <KernelProvider neural={neural} model={model}>
      <Desktop />
    </KernelProvider>
  );
}

function Desktop() {
  const { state, run, deskRef, neural } = useNova();
  const [intent, setIntent] = useState(false);
  const [bell, setBell] = useState(false);

  // ── اختصارات النظام
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIntent((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setIntent(false);
        setBell(false);
        return;
      }
      if (!mod) return;
      const inField = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName ?? "");
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const ordered = [...state.windows].sort((a, b) => a.z - b.z);

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

            {ordered.map((w) => (
              <WindowFrame key={w.id} win={w}>
                <AppHost win={w} />
              </WindowFrame>
            ))}
          </div>

          {intent && <IntentBar onClose={() => setIntent(false)} />}
          {bell && <NotifCenter onClose={() => setBell(false)} />}
          <Toasts />
          <Dock onIntent={() => setIntent((v) => !v)} />
        </>
      )}
    </div>
  );
}
