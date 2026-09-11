/**
 * عامل خدمة نوفا — قشرة تعمل بلا شبكة.
 *
 * قواعد متحفّظة بقصد، لأن عامل خدمة سيّئ أسوأ من لا شيء:
 *  1) لا يلمس /api إطلاقًا: بيانات المزرعة والذكاء والجلسة تحتاج الشبكة
 *     والحقيقة اللحظية، وتخزينها المؤقّت يعني عرض أرقام ميتة.
 *  2) لا يتدخّل في أي طلب غير GET، ولا في نطاق آخر.
 *  3) الأصول الساكنة: من الذاكرة فورًا مع تحديثها في الخلفية.
 *  4) التنقّل إلى /os: الشبكة أولًا، والذاكرة عند انقطاعها — هكذا تُقلع نوفا
 *     على طائرة، وتظل الجلسة محفوظة في IndexedDB.
 */

const VERSION = "nova-v1";
const SHELL = ["/os", "/manifest.webmanifest", "/nova-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // تنقّل: الشبكة أولًا حتى تبقى الجلسة والهوية صحيحتين، والذاكرة شبكة أمان
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/os", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/os").then((hit) => hit || caches.match(req)))
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?|ico|webmanifest)$/.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
