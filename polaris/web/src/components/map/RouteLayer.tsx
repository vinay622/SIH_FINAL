import { useEffect, useRef } from "react";
import L from "leaflet";
import type { RouteOut } from "../../lib/api";
import { num, pct } from "../../lib/format";
import { usePolarisMap } from "./PolarisMap";

export interface RouteLayerProps {
  routes?: Record<string, RouteOut>;
  selectedProfile?: string;
  autoFitBounds?: boolean;
  onRouteSelect?: (profile: string) => void;
}

const PROFILE_COLORS: Record<string, { color: string; glow: string; weight: number }> = {
  polaris: { color: "#22d3ee", glow: "rgba(34, 211, 238, 0.4)", weight: 4 },
  safest: { color: "#4ade80", glow: "rgba(74, 222, 128, 0.4)", weight: 3 },
  shortest: { color: "#facc15", glow: "rgba(250, 204, 21, 0.4)", weight: 3 },
  fallback: { color: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", weight: 2.5 },
};

export function RouteLayer({
  routes,
  selectedProfile,
  autoFitBounds = false,
  onRouteSelect,
}: RouteLayerProps) {
  const { map } = usePolarisMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map || !routes || Object.keys(routes).length === 0) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    const group = L.layerGroup();
    const allLatLngs: [number, number][] = [];

    Object.entries(routes).forEach(([profileKey, route]) => {
      if (!route) return;

      const profile = route.profile || profileKey;
      const isSelected = selectedProfile === profile;
      const config = PROFILE_COLORS[profile] || PROFILE_COLORS.fallback;

      // Extract coordinates from GeoJSON geometry or waypoints
      let latLngs: [number, number][] = [];
      if (route.geometry && "coordinates" in route.geometry) {
        const coords = (route.geometry as { coordinates: number[][] }).coordinates;
        latLngs = coords.map(([lon, lat]) => [lat, lon]);
      } else if (route.waypoints && route.waypoints.length > 0) {
        latLngs = route.waypoints.map((wp) => [wp.latitude, wp.longitude]);
      }

      if (latLngs.length < 2) return;

      latLngs.forEach((coord) => allLatLngs.push(coord));

      // Route polyline with shadow glow
      const polyline = L.polyline(latLngs, {
        color: config.color,
        weight: isSelected ? config.weight + 2 : config.weight,
        opacity: isSelected ? 1.0 : 0.85,
        dashArray: profile === "shortest" ? "6, 6" : undefined,
        lineCap: "round",
        lineJoin: "round",
      });

      // Hover and click interaction
      polyline.on("mouseover", () => {
        polyline.setStyle({ weight: config.weight + 3, opacity: 1.0 });
      });
      polyline.on("mouseout", () => {
        polyline.setStyle({
          weight: isSelected ? config.weight + 2 : config.weight,
          opacity: isSelected ? 1.0 : 0.85,
        });
      });

      if (onRouteSelect) {
        polyline.on("click", () => {
          onRouteSelect(profile);
        });
      }

      // Tooltip
      polyline.bindTooltip(`
        <div style="background:#080e19; border:1px solid ${config.color}; color:#f1f5f9; padding:6px 10px; font-family:'JetBrains Mono', monospace; font-size:11px; border-radius:4px;">
          <div style="color:${config.color}; font-weight:bold; letter-spacing:0.05em;">
            PROFILE: ${profile.toUpperCase()}
          </div>
          <div style="margin-top:2px; display:flex; gap:8px;">
            <span>${num(route.distanceKm, 0)} KM</span>
            <span style="color:#64748b;">•</span>
            <span>${num(route.durationHours, 1)} HRS</span>
            <span style="color:#64748b;">•</span>
            <span style="color:#f87171;">RISK ${pct(route.meanRisk, 1)}</span>
          </div>
        </div>
      `, {
        sticky: true,
        className: "custom-leaflet-tooltip",
      });

      group.addLayer(polyline);

      // Start and End waypoints
      const startPt = latLngs[0];
      const endPt = latLngs[latLngs.length - 1];

      const makeWaypointDot = (pt: [number, number], label: string, isEnd = false) => {
        const icon = L.divIcon({
          className: "route-waypoint-dot",
          html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
              <div class="w-2.5 h-2.5 rounded-full ${isEnd ? "bg-status-safe" : "bg-primary"} border border-black shadow"></div>
            </div>
          `,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        const marker = L.marker(pt, { icon });
        marker.bindTooltip(label, { direction: "top", offset: [0, -6] });
        group.addLayer(marker);
      };

      if (isSelected || Object.keys(routes).length === 1) {
        makeWaypointDot(startPt, "DEPARTURE");
        makeWaypointDot(endPt, "DESTINATION", true);
      }
    });

    group.addTo(map);
    layerGroupRef.current = group;

    if (autoFitBounds && allLatLngs.length > 0) {
      map.fitBounds(allLatLngs, { padding: [40, 40] });
    }

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map, routes, selectedProfile, autoFitBounds, onRouteSelect]);

  return null;
}
