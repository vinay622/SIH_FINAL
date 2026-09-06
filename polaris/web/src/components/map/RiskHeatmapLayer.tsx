import { useEffect, useRef } from "react";
import L from "leaflet";
import type { RiskMapResponse } from "../../lib/types";
import { coord, pct } from "../../lib/format";
import { usePolarisMap } from "./PolarisMap";

export interface RiskHeatmapLayerProps {
  data?: RiskMapResponse;
  opacity?: number;
  showHotspots?: boolean;
  onCellClick?: (lat: number, lon: number) => void;
}

// Convert a risk score (0.0 to 1.0) to RGBA
// Convert a risk score (0.0 to 1.0) to smooth continuous RGBA
function riskToRgba(risk: number | null): [number, number, number, number] {
  if (risk === null || risk === undefined || isNaN(risk) || risk <= 0.08) {
    return [0, 0, 0, 0]; // transparent for open navigable water
  }
  if (risk <= 0.3) {
    // 0.08..0.30: soft marine teal/cyan
    const t = (risk - 0.08) / 0.22;
    return [
      Math.round(14 + (34 - 14) * t),
      Math.round(165 + (197 - 165) * t),
      Math.round(233 + (94 - 233) * t),
      Math.round(45 + 50 * t),
    ];
  } else if (risk <= 0.55) {
    // 0.30..0.55: amber caution
    const t = (risk - 0.3) / 0.25;
    return [
      Math.round(34 + (234 - 34) * t),
      Math.round(197 + (179 - 197) * t),
      Math.round(94 * (1 - t)),
      Math.round(95 + 40 * t),
    ];
  } else if (risk <= 0.75) {
    // 0.55..0.75: vivid orange hazard
    const t = (risk - 0.55) / 0.2;
    return [
      Math.round(234 + (249 - 234) * t),
      Math.round(179 + (115 - 179) * t),
      Math.round(22 * t),
      Math.round(135 + 40 * t),
    ];
  } else {
    // 0.75..1.0: severe crimson icepack
    const t = Math.min(1, (risk - 0.75) / 0.25);
    return [
      Math.round(249 + (220 - 249) * t),
      Math.round(115 * (1 - t)),
      Math.round(22 * (1 - t)),
      Math.round(175 + 50 * t),
    ];
  }
}

export function RiskHeatmapLayer({
  data,
  opacity = 0.75,
  showHotspots = true,
  onCellClick,
}: RiskHeatmapLayerProps) {
  const { map } = usePolarisMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const hotspotsGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map || !data) return;

    const { lats, lons, totalRiskField, hotspots } = data;
    if (!lats?.length || !lons?.length || !totalRiskField?.length) return;

    // Clean up previous layers
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }
    if (hotspotsGroupRef.current) {
      map.removeLayer(hotspotsGroupRef.current);
      hotspotsGroupRef.current = null;
    }

    const nLats = lats.length;
    const nLons = lons.length;

    // Create offscreen canvas for crisp hardware-accelerated rendering
    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = nLons;
    rawCanvas.height = nLats;
    const ctx = rawCanvas.getContext("2d");

    if (ctx) {
      const imgData = ctx.createImageData(nLons, nLats);
      const buf = imgData.data;

      const latMin = Math.min(...lats);
      const latMax = Math.max(...lats);
      const lonMin = Math.min(...lons);
      const lonMax = Math.max(...lons);

      const isLatDescending = lats[0] > lats[nLats - 1];

      for (let i = 0; i < nLats; i++) {
        const rowIdx = isLatDescending ? i : nLats - 1 - i;
        const row = totalRiskField[rowIdx];
        if (!row) continue;

        for (let j = 0; j < nLons; j++) {
          const val = row[j];
          const [r, g, b, a] = riskToRgba(val);
          const pixelIndex = (i * nLons + j) * 4;
          buf[pixelIndex] = r;
          buf[pixelIndex + 1] = g;
          buf[pixelIndex + 2] = b;
          buf[pixelIndex + 3] = a;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Upscale 4x with high-quality bilinear smoothing for a natural meteorological gradient
      const scale = 4;
      const smoothCanvas = document.createElement("canvas");
      smoothCanvas.width = nLons * scale;
      smoothCanvas.height = nLats * scale;
      const sCtx = smoothCanvas.getContext("2d");
      if (sCtx) {
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = "high";
        sCtx.drawImage(rawCanvas, 0, 0, smoothCanvas.width, smoothCanvas.height);
      }

      // Bounds for image overlay
      const dlat = (latMax - latMin) / (nLats - 1 || 1);
      const dlon = (lonMax - lonMin) / (nLons - 1 || 1);
      const bounds: L.LatLngBoundsExpression = [
        [latMin - dlat / 2, lonMin - dlon / 2],
        [latMax + dlat / 2, lonMax + dlon / 2],
      ];

      const overlay = L.imageOverlay(smoothCanvas.toDataURL(), bounds, {
        opacity,
        interactive: true,
        className: "risk-heatmap-overlay",
      });

      overlay.on("click", (e: L.LeafletMouseEvent) => {
        if (onCellClick) {
          onCellClick(e.latlng.lat, e.latlng.lng);
        }
      });

      overlay.addTo(map);
      overlayRef.current = overlay;
    }

    // Render hotspot indicators (minimalist tactical glyphs with hover tooltip)
    if (showHotspots && hotspots && hotspots.length > 0) {
      const group = L.layerGroup();

      hotspots.slice(0, 6).forEach((spot, idx) => {
        const markerHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <div class="absolute -inset-1 rounded-full bg-status-danger opacity-40 animate-ping"></div>
            <div class="w-3 h-3 rounded-full bg-status-danger border border-white shadow-[0_0_8px_rgba(239,68,68,0.8)] flex items-center justify-center">
              <span class="text-[7px] font-bold text-white">${idx + 1}</span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: "risk-hotspot-pin",
          html: markerHtml,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([spot.latitude, spot.longitude], { icon });
        marker.bindPopup(`
          <div style="background:#080e19; border:1px solid #ef4444; color:#f1f5f9; padding:8px 12px; font-family:'JetBrains Mono', monospace; font-size:12px; border-radius:4px;">
            <div style="color:#ef4444; font-weight:bold; letter-spacing:0.05em; display:flex; align-items:center; gap:6px;">
              <span>⚠ RISK HOTSPOT #${idx + 1}</span>
            </div>
            <div style="color:#f87171; font-size:14px; font-weight:bold; margin-top:4px;">
              TOTAL RISK: ${pct(spot.totalRisk, 1)}
            </div>
            <div style="color:#94a3b8; font-size:11px; margin-top:2px;">
              PRIMARY FACTOR: <span style="color:#8aebff;">${spot.dominantComponent.toUpperCase()}</span>
            </div>
            <div style="color:#64748b; font-size:10px; margin-top:4px;">
              ${coord(spot.latitude, spot.longitude)}
            </div>
          </div>
        `, {
          className: "custom-leaflet-popup",
          closeButton: false,
        });

        group.addLayer(marker);
      });

      group.addTo(map);
      hotspotsGroupRef.current = group;
    }

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      if (hotspotsGroupRef.current) {
        map.removeLayer(hotspotsGroupRef.current);
        hotspotsGroupRef.current = null;
      }
    };
  }, [map, data, opacity, showHotspots, onCellClick]);

  return null;
}
