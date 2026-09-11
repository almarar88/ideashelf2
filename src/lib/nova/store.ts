/**
 * تخزين الجلسة.
 *
 * بدأت نوفا على localStorage، وكان ذلك كافيًا حين كان المحتوى نصوصًا فقط.
 * لكن النظام صار يقبل ملفات المستخدم الحقيقية — وصورة واحدة تستهلك حدّ
 * الخمسة ميجابايت كله. لذلك: IndexedDB أولًا (حدّه أكبر بمراتب وغير متزامن)،
 * و localStorage يبقى احتياطًا لأن نظام التشغيل لا يجوز أن يفقد جلستك
 * لأن متصفحًا حجب قاعدة بيانات.
 */

const DB_NAME = "nova.os";
const STORE = "state";
const KEY = "session";
const LS_KEY = "nova.os.v1";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      // متصفح يحجب التخزين قد لا يُطلق أي حدث: لا ننتظر للأبد
      window.setTimeout(() => resolve(null), 1500);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSession(data: unknown): Promise<"idb" | "local" | "none"> {
  const json = JSON.stringify(data);
  const db = await openDb();
  if (db) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(json, KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    if (ok) {
      // نُبقي أثرًا صغيرًا في localStorage كي يعرف الإقلاع أين يبحث
      try {
        window.localStorage.setItem(`${LS_KEY}.where`, "idb");
      } catch {
        /* لا يهم */
      }
      return "idb";
    }
  }
  try {
    window.localStorage.setItem(LS_KEY, json);
    window.localStorage.setItem(`${LS_KEY}.where`, "local");
    return "local";
  } catch {
    // التخزين ممتلئ أو محجوب: النظام يعمل، لكن الجلسة لن تدوم
    return "none";
  }
}

export async function loadSession<T>(): Promise<T | null> {
  const db = await openDb();
  if (db) {
    const raw = await new Promise<string | null>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (raw) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
    } catch {
      /* تجاهل */
    }
  }
  try {
    window.localStorage.removeItem(LS_KEY);
    window.localStorage.removeItem(`${LS_KEY}.where`);
  } catch {
    /* تجاهل */
  }
}

/** تقدير المساحة المستخدمة — يعرضه تطبيق «الهوية» */
export async function storageInfo(): Promise<{ used: number; quota: number; where: string }> {
  let where = "غير معروف";
  try {
    where = window.localStorage.getItem(`${LS_KEY}.where`) === "idb" ? "IndexedDB" : "localStorage";
  } catch {
    /* تجاهل */
  }
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage ?? 0, quota: est.quota ?? 0, where };
    }
  } catch {
    /* تجاهل */
  }
  return { used: 0, quota: 0, where };
}

/** حدود الاستيراد: نظام تشغيل في متصفح لا يجوز أن يخنق نفسه بملف واحد */
export const IMPORT_LIMITS = {
  maxFiles: 12,
  maxBytes: 3 * 1024 * 1024,
  textTypes: /^(text\/|application\/(json|xml|javascript|x-yaml))/,
  imageTypes: /^image\//,
};

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "application/octet-stream";
  if (head.includes("base64")) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

/** يقرأ ملفًا حقيقيًا إلى نص أو data URL بحسب نوعه */
export function readFile(file: File): Promise<{ content: string; kind: "text" | "image" } | null> {
  return new Promise((resolve) => {
    const isText = IMPORT_LIMITS.textTypes.test(file.type) || file.type === "";
    const isImage = IMPORT_LIMITS.imageTypes.test(file.type);
    if (!isText && !isImage) return resolve(null);
    if (file.size > IMPORT_LIMITS.maxBytes) return resolve(null);

    const reader = new FileReader();
    reader.onload = () =>
      resolve({ content: String(reader.result ?? ""), kind: isImage ? "image" : "text" });
    reader.onerror = () => resolve(null);
    if (isImage) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}
