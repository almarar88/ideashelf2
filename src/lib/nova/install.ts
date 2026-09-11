/**
 * تثبيت نوفا كتطبيق.
 *
 * المتصفح يُطلق beforeinstallprompt مرة واحدة وباكرًا — أحيانًا قبل أن
 * يُركّب أي مكوّن. لذلك نلتقطه على مستوى الوحدة (أول ما يُحمّل الجانب
 * العميل) ونحتفظ به، ثم تشترك الواجهة عليه. من دون هذا الالتقاط المبكّر
 * يضيع الحدث ولا يظهر زر التثبيت أبدًا.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

/**
 * متجر خارجي بشكله القياسي (subscribe + getSnapshot) ليُقرأ بـ
 * useSyncExternalStore: هذه هي الطريقة الصحيحة لقراءة حالة يملكها
 * المتصفح لا React — بلا ضبط حالة داخل أثر.
 */
export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getInstallSnapshot(): boolean {
  return deferred !== null;
}

/** يشترك على تغيّر وضع العرض (صفحة ↔ تطبيق مثبّت) */
export function subscribeDisplayMode(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const queries = [
    window.matchMedia("(display-mode: standalone)"),
    window.matchMedia("(display-mode: window-controls-overlay)"),
  ];
  queries.forEach((q) => q.addEventListener("change", cb));
  return () => queries.forEach((q) => q.removeEventListener("change", cb));
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    emit();
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "dismissed";
  }
}

/** هل نعمل الآن كتطبيق مثبّت لا كصفحة في متصفح؟ */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches === true ||
    nav.standalone === true
  );
}

/** يسجّل عامل الخدمة — قشرة تعمل بلا شبكة */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const go = () => {
    navigator.serviceWorker.register("/nova-sw.js", { scope: "/" }).catch(() => {
      /* المتصفح يمنع أو السياق غير آمن: النظام يعمل بلا وضع الطيران */
    });
  };

  /**
   * نوفا تُحمّل ديناميكيًا (بلا تصيير مسبق)، فهي تُركَّب عادةً *بعد* حدث load.
   * الاكتفاء بـ addEventListener("load") يعني أن التسجيل لا يحدث أبدًا —
   * وهو ما كان يجري فعلًا حتى كشفه الفحص. لذلك نتحقّق من الحالة أولًا.
   */
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
