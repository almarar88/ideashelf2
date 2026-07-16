"use client";

import dynamic from "next/dynamic";

export const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: () => <div style={{ height: 320 }} className="animate-pulse rounded-xl bg-[var(--surface-muted)]" />,
  }
);
