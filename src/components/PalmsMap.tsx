"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import Link from "next/link";
import { ensureLeafletIcons, coloredDivIcon } from "./LeafletSetup";
import { PALM_STATUS_COLORS, PALM_STATUS_LABELS, type PalmStatus } from "@/lib/constants";

export type PalmMapPoint = {
  id: string;
  code: string;
  variety: string;
  status: string;
  lat: number | null;
  lng: number | null;
};

export function PalmsMap({
  palms,
  center,
  farmMarker,
  height = 420,
}: {
  palms: PalmMapPoint[];
  center: [number, number];
  farmMarker?: { lat: number; lng: number; areaHectares?: number | null };
  height?: number;
}) {
  ensureLeafletIcons();

  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={18} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {farmMarker && (
          <Circle
            center={[farmMarker.lat, farmMarker.lng]}
            radius={Math.sqrt((farmMarker.areaHectares || 5) * 10000 / Math.PI)}
            pathOptions={{ color: "#2f6b3a", fillOpacity: 0.05 }}
          />
        )}
        {palms
          .filter((p): p is PalmMapPoint & { lat: number; lng: number } => p.lat != null && p.lng != null)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={coloredDivIcon(PALM_STATUS_COLORS[p.status as PalmStatus] ?? "#2f6b3a")}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold">{p.code}</div>
                  <div>{p.variety}</div>
                  <div>{PALM_STATUS_LABELS[p.status as PalmStatus] ?? p.status}</div>
                  <Link href={`/palms/${p.id}`} className="text-green-700 underline">
                    عرض الملف
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
