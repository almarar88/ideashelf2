"use client";

import dynamic from "next/dynamic";

export const PalmsMap = dynamic(() => import("./PalmsMap").then((m) => m.PalmsMap), {
  ssr: false,
  loading: () => <div style={{ height: 420 }} className="animate-pulse rounded-xl bg-[var(--surface-muted)]" />,
});

export type { PalmMapPoint } from "./PalmsMap";
