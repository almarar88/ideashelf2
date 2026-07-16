"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { ensureLeafletIcons } from "./LeafletSetup";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPickerMap({
  lat,
  lng,
  onChange,
  height = 320,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  ensureLeafletIcons();

  return (
    <div style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={16} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} />
        <ClickHandler onPick={onChange} />
      </MapContainer>
      <p className="mt-2 text-xs text-gray-400">انقر في أي مكان على الخريطة لتحديد الموقع</p>
    </div>
  );
}
