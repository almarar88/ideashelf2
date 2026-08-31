"use client";

import L from "leaflet";

let configured = false;

export function ensureLeafletIcons() {
  if (configured) return;
  configured = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}

export function coloredDivIcon(color: string, label?: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
        background:${color};
        width:26px;height:26px;border-radius:50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      "><span style="transform: rotate(45deg); font-size:12px; color:white; font-weight:bold;">${label ?? ""}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}
