import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* ------------------------------ لبنات أساسية ------------------------------ */

export function Panel({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`panel ${padded ? "p-4" : ""} ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{actions}</div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && (
        <span className="block text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} className={`input ${props.className ?? ""}`} />;
  },
);

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ""}`} />;
}

export function Button({
  variant = "default",
  size = "md",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "md" | "sm";
}) {
  const cls = [
    "btn",
    variant === "primary" ? "btn-primary" : "",
    variant === "danger" ? "btn-danger" : "",
    variant === "ghost" ? "btn-ghost" : "",
    size === "sm" ? "btn-sm" : "",
    rest.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}

export function Badge({
  tone = "default",
  children,
}: {
  tone?: "default" | "ok" | "warn" | "danger" | "accent";
  children: React.ReactNode;
}) {
  const cls = tone === "default" ? "badge" : `badge badge-${tone}`;
  return <span className={cls}>{children}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="font-semibold" style={{ color: "var(--ink-2)" }}>
        {title}
      </p>
      {hint && (
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "danger" | "ok";
}) {
  const color = tone === "danger" ? "var(--danger)" : tone === "ok" ? "var(--ok)" : "var(--ink)";
  return (
    <Panel className="min-w-0">
      <div className="text-xs mb-1 truncate" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      {hint && (
        <div className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------- النوافذ -------------------------------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 720,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel rise w-full"
        style={{ maxWidth: width, boxShadow: "var(--shadow)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق">
            ✕
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-4 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------- التنبيهات والتأكيدات -------------------------- */

type Toast = { id: number; text: string; tone: "info" | "ok" | "danger" };
type ConfirmRequest = { text: string; detail?: string; resolve: (ok: boolean) => void };

interface UiContextValue {
  toast: (text: string, tone?: Toast["tone"]) => void;
  confirm: (text: string, detail?: string) => Promise<boolean>;
}

const UiContext = createContext<UiContextValue>({
  toast: () => undefined,
  confirm: async () => false,
});

export const useUi = () => useContext(UiContext);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (text: string, detail?: string) =>
      new Promise<boolean>((resolve) => setRequest({ text, detail, resolve })),
    [],
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-4 z-[80] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="panel rise px-4 py-3 text-sm"
            style={{
              boxShadow: "var(--shadow)",
              borderColor:
                t.tone === "danger"
                  ? "color-mix(in srgb, var(--danger) 50%, var(--border))"
                  : t.tone === "ok"
                    ? "color-mix(in srgb, var(--ok) 50%, var(--border))"
                    : "var(--border)",
              color: t.tone === "danger" ? "var(--danger)" : t.tone === "ok" ? "var(--ok)" : "var(--ink)",
              maxWidth: 420,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
      <Modal
        open={!!request}
        title="تأكيد"
        width={460}
        onClose={() => {
          request?.resolve(false);
          setRequest(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                request?.resolve(false);
                setRequest(null);
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                request?.resolve(true);
                setRequest(null);
              }}
            >
              تأكيد
            </Button>
          </>
        }
      >
        <p>{request?.text}</p>
        {request?.detail && (
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            {request.detail}
          </p>
        )}
      </Modal>
    </UiContext.Provider>
  );
}

/* --------------------------------- أدوات --------------------------------- */

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 mb-3">{children}</div>;
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="px-4 py-2 text-sm rounded-t-lg"
            style={{
              color: on ? "var(--accent)" : "var(--muted)",
              borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              fontWeight: on ? 700 : 500,
              background: on ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
            {typeof t.count === "number" && <span className="mx-1 opacity-70">({t.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
