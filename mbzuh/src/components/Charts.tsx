/**
 * رسوم بسيطة مبنية بلا مكتبات: أشرطة أفقية للمقادير وشريط مقسّم للحالات.
 * ألوان السلاسل مأخوذة من متغيرات الثيم بعد التحقق من تباينها وتمييزها
 * لعمى الألوان في الوضعين الداكن والفاتح.
 */
import { Panel } from "./ui";

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-neutral)"];

export function BarList({
  title,
  hint,
  data,
  unit = "",
  emptyText = "لا توجد بيانات بعد",
}: {
  title: string;
  hint?: string;
  data: { label: string; value: number }[];
  unit?: string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Panel className="h-full">
      <div className="mb-3">
        <h3 className="font-bold text-sm">{title}</h3>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {hint}
          </p>
        )}
      </div>
      {data.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((d) => (
            <li key={d.label} title={`${d.label}: ${d.value}${unit}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[12.5px] truncate" style={{ color: "var(--ink-2)" }}>
                  {d.label}
                </span>
                <span className="text-[12.5px] tabular-nums font-semibold" style={{ color: "var(--ink)" }}>
                  {d.value}
                  {unit}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--grid)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(2, (d.value / max) * 100)}%`,
                    height: "100%",
                    background: "var(--series-2)",
                    borderStartEndRadius: 4,
                    borderEndEndRadius: 4,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function SegmentedBar({
  title,
  hint,
  data,
}: {
  title: string;
  hint?: string;
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Panel className="h-full">
      <div className="mb-3">
        <h3 className="font-bold text-sm">{title}</h3>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {hint}
          </p>
        )}
      </div>
      {total === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>
          لا توجد بيانات بعد
        </p>
      ) : (
        <>
          <div className="flex gap-[2px] mb-3" style={{ height: 14 }}>
            {data
              .filter((d) => d.value > 0)
              .map((d, i) => (
                <div
                  key={d.label}
                  title={`${d.label}: ${d.value}`}
                  style={{
                    flex: d.value,
                    background: SERIES[i % SERIES.length],
                    borderRadius: 4,
                  }}
                />
              ))}
          </div>
          <ul className="flex flex-col gap-2">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="flex items-center gap-2 truncate" style={{ color: "var(--ink-2)" }}>
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: SERIES[i % SERIES.length],
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {d.label}
                </span>
                <span className="tabular-nums font-semibold">
                  {d.value}
                  <span className="mx-1 font-normal" style={{ color: "var(--muted)" }}>
                    ({total ? Math.round((d.value / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function Meter({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  const tone = value === null ? "var(--muted)" : pct >= 85 ? "var(--ok)" : pct >= 70 ? "var(--warn)" : "var(--danger)";
  return (
    <Panel>
      <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: tone }}>
        {value === null ? "—" : `${pct}%`}
      </div>
      <div style={{ height: 8, background: "var(--grid)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone,
            borderStartEndRadius: 4,
            borderEndEndRadius: 4,
          }}
        />
      </div>
      {hint && (
        <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      )}
    </Panel>
  );
}
