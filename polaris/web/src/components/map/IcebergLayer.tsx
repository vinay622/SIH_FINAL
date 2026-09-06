import { useEffect, useRef } from "react";
import L from "leaflet";
import type { IcebergOut, IcebergTrajectory } from "../../lib/api";
import { coord, num } from "../../lib/format";
import { usePolarisMap } from "./PolarisMap";

export interface IcebergLayerProps {
  icebergs?: IcebergOut[];
  selectedIcebergId?: string | null;
  activeTrajectory?: IcebergTrajectory | null;
  onSelectIceberg?: (icebergId: string) => void;
}

export function IcebergLayer({
  icebergs,
  selectedIcebergId,
  activeTrajectory,
  onSelectIceberg,
}: IcebergLayerProps) {
  const { map } = usePolarisMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map || !icebergs) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    const group = L.layerGroup();

    // 1. Render all iceberg markers (sleek tactical diamonds with hover tooltips)
    icebergs.forEach((berg) => {
      const isSelected = selectedIcebergId === berg.icebergId;
      const isFast = berg.driftSpeedM > 0.2;
      const isLarge = berg.areaKm2 > 100;

      const borderColor = isSelected ? "#8aebff" : isFast ? "#f87171" : "#38bdf8";
      const fillColor = isSelected ? "#22d3ee" : isFast ? "#ef4444" : "#0369a1";
      const scale = isLarge ? "scale-110" : "scale-90";

      const html = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-130 ${scale}">
          ${isSelected ? '<div class="absolute -inset-2 rounded-full border border-primary animate-ping opacity-75"></div>' : ""}
          <div class="w-3 h-3 rotate-45 border shadow-[0_0_8px_rgba(56,189,248,0.6)] flex items-center justify-center" style="background-color: ${fillColor}; border-color: ${borderColor};">
            <div class="w-0.5 h-0.5 bg-white rounded-full"></div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-iceberg-marker",
        html,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([berg.latitude, berg.longitude], { icon });

      // Interactive hover tooltip (zero clutter when not hovering)
      marker.bindTooltip(`
        <div style="background:#080e19; border:1px solid ${borderColor}; color:#f1f5f9; padding:4px 8px; font-family:'JetBrains Mono', monospace; font-size:11px; border-radius:3px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <span style="color:#8aebff; font-weight:bold;">${berg.icebergId}</span>
          <span style="color:#94a3b8; margin-left:6px;">${num(berg.areaKm2, 0)} km² | ${num(berg.driftSpeedM, 2)} m/s</span>
        </div>
      `, {
        direction: "top",
        offset: [0, -8],
        opacity: 0.95,
      });

      marker.bindPopup(`
        <div style="background:#080e19; border:1px solid #38bdf8; color:#f1f5f9; padding:8px 12px; font-family:'JetBrains Mono', monospace; font-size:12px; border-radius:4px; min-width:180px;">
          <div style="color:#8aebff; font-weight:bold; letter-spacing:0.05em; display:flex; justify-content:space-between;">
            <span>${berg.icebergId}</span>
            <span style="color:#94a3b8; font-size:10px;">${berg.source}</span>
          </div>
          <div style="color:#94a3b8; font-size:11px; margin-top:4px;">
            AREA: <span style="color:#f1f5f9; font-weight:bold;">${num(berg.areaKm2, 1)} km²</span>
          </div>
          <div style="color:#94a3b8; font-size:11px;">
            SIZE: ${num(berg.lengthNm, 1)} × ${num(berg.widthNm, 1)} NM
          </div>
          <div style="color:#94a3b8; font-size:11px;">
            DRIFT: <span style="color:#facc15; font-weight:bold;">${num(berg.driftSpeedM, 2)} m/s</span> @ ${num(berg.driftBearingDeg, 0)}°
          </div>
          <div style="color:#64748b; font-size:10px; margin-top:4px;">
            ${coord(berg.latitude, berg.longitude)}
          </div>
        </div>
      `, {
        className: "custom-leaflet-popup",
        closeButton: false,
      });

      if (onSelectIceberg) {
        marker.on("click", () => {
          onSelectIceberg(berg.icebergId);
        });
      }

      group.addLayer(marker);
    });

    // 2. Render trajectory if available
    if (activeTrajectory && activeTrajectory.points && activeTrajectory.points.length > 0) {
      const trajCoords = activeTrajectory.points.map((p) => [p.latitude, p.longitude] as [number, number]);

      const trajLine = L.polyline(trajCoords, {
        color: "#f87171",
        weight: 3,
        dashArray: "4, 6",
        opacity: 0.9,
      });

      trajLine.bindTooltip(`
        <div style="background:#080e19; border:1px solid #f87171; color:#f1f5f9; padding:6px 8px; font-family:'JetBrains Mono', monospace; font-size:11px;">
          <div style="color:#f87171; font-weight:bold;">RK4 DRIFT TRAJECTORY</div>
          <div style="color:#94a3b8; font-size:10px;">ENSEMBLE: ${activeTrajectory.ensembleSize} MEMBERS</div>
          <div style="color:#f1f5f9; font-size:10px;">HORIZON: +${activeTrajectory.points[activeTrajectory.points.length - 1].hoursAhead}h</div>
        </div>
      `);

      group.addLayer(trajLine);

      // Uncertainty circles along the trajectory
      activeTrajectory.points.forEach((pt) => {
        if (pt.hoursAhead > 0 && pt.hoursAhead % 24 === 0) {
          const uncertaintyRadiusMeters = pt.hoursAhead * 800; // growing spread cone
          const circle = L.circle([pt.latitude, pt.longitude], {
            radius: uncertaintyRadiusMeters,
            color: "#f87171",
            fillColor: "#ef4444",
            fillOpacity: 0.12,
            weight: 1,
            dashArray: "2, 4",
          });
          group.addLayer(circle);

          const dotIcon = L.divIcon({
            className: "traj-pt-dot",
            html: `<div class="px-1 py-0.5 bg-[#080e19] border border-[#f87171] rounded text-[9px] font-mono text-[#f87171] -translate-x-1/2 -translate-y-1/2">+${pt.hoursAhead}h</div>`,
            iconSize: [28, 14],
            iconAnchor: [14, 7],
          });
          const ptMarker = L.marker([pt.latitude, pt.longitude], { icon: dotIcon });
          group.addLayer(ptMarker);
        }
      });
    }

    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map, icebergs, selectedIcebergId, activeTrajectory, onSelectIceberg]);

  return null;
}
