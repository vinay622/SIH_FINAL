import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { getNavigationLandmask, getNavigationStations, type StationOut } from "../../lib/api";
import { coord } from "../../lib/format";
import { Icon } from "../Icon";

// ---------- Map Context for child layers ----------

interface MapContextValue {
  map: L.Map | null;
}

const MapContext = createContext<MapContextValue>({ map: null });

export function usePolarisMap() {
  return useContext(MapContext);
}

// ---------- Station Tactical Marker HTML ----------

function createStationIcon(station: StationOut) {
  const isGateway = station.key === "cape_town";
  const bgClass = isGateway ? "bg-status-telemetry" : "bg-primary";
  const borderClass = isGateway ? "border-status-telemetry" : "border-primary";
  const glowClass = isGateway ? "shadow-[0_0_12px_rgba(96,165,250,0.6)]" : "shadow-[0_0_12px_rgba(138,235,255,0.7)]";
  const shortName = station.name.replace(" Station", "").replace(" (resupply port)", "").toUpperCase();

  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
      <div class="absolute -inset-1.5 rounded-full ${bgClass} opacity-30 animate-ping"></div>
      <div class="relative w-3 h-3 rounded-full ${bgClass} border-2 border-[#080e19] ${glowClass} flex items-center justify-center">
        <div class="w-1 h-1 rounded-full bg-white"></div>
      </div>
      <div class="absolute left-3.5 px-1.5 py-0.5 bg-[#080e19]/95 border ${borderClass} rounded text-[9px] font-mono font-bold tracking-wider text-[#f1f5f9] whitespace-nowrap pointer-events-none shadow-md">
        ${shortName}
      </div>
    </div>
  `;

  return L.divIcon({
    className: "custom-station-pin",
    html,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// ---------- Props ----------

export interface PolarisMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
  onPointClick?: (lat: number, lon: number) => void;
  showStations?: boolean;
  showLandmask?: boolean;
  showCoordinatesHud?: boolean;
}

export function PolarisMap({
  center = [-67.8, 44.0],
  zoom = 4,
  className = "w-full h-full min-h-[400px]",
  children,
  onPointClick,
  showStations = true,
  showLandmask = true,
  showCoordinatesHud = true,
}: PolarisMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lon: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  // Queries for base layers
  const landmaskQ = useQuery({
    queryKey: ["navigation", "landmask"],
    queryFn: getNavigationLandmask,
    staleTime: Infinity,
    enabled: showLandmask,
  });

  const stationsQ = useQuery({
    queryKey: ["navigation", "stations"],
    queryFn: getNavigationStations,
    staleTime: 60 * 60_000,
    enabled: showStations,
  });

  // Initialize map instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      maxBounds: [
        [-89, -180],
        [-20, 180],
      ],
    });

    // Dark tiles from ESRI World Dark Gray Canvas (clean, no watermark, fast)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Esri, DeLorme, NAVTEQ",
    }).addTo(map);

    // Zoom control in bottom-left
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    // Mouse telemetry listener
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setCursorPos({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  // Update click handler if changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.off("click");
    if (onPointClick) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPointClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [onPointClick]);

  // Landmask layer (subtle non-navigable mask without harsh internal stroke lines)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !landmaskQ.data || !showLandmask) return;

    const landmaskLayer = L.geoJSON(landmaskQ.data, {
      style: {
        fillColor: "#060b14",
        fillOpacity: 0.7,
        stroke: false,
        weight: 0,
      },
    }).addTo(map);

    return () => {
      map.removeLayer(landmaskLayer);
    };
  }, [landmaskQ.data, showLandmask]);

  // Station markers layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stationsQ.data?.stations || !showStations) return;

    const group = L.layerGroup();
    stationsQ.data.stations.forEach((station) => {
      const marker = L.marker([station.latitude, station.longitude], {
        icon: createStationIcon(station),
      });

      marker.bindPopup(`
        <div style="background:#080e19; border:1px solid #1e3a5f; color:#f1f5f9; padding:8px 12px; font-family:'JetBrains Mono', monospace; font-size:12px; border-radius:4px;">
          <div style="color:#8aebff; font-weight:bold; letter-spacing:0.05em; margin-bottom:4px;">${station.name.toUpperCase()}</div>
          <div style="color:#94a3b8; font-size:11px;">OPERATOR: ${station.operator || "—"}</div>
          <div style="color:#94a3b8; font-size:11px;">REGION: ${station.region || "—"}</div>
          <div style="color:#60a5fa; font-size:11px; margin-top:4px;">${coord(station.latitude, station.longitude)}</div>
          <div style="color:${station.inDomain ? "#4ade80" : "#facc15"}; font-size:10px; margin-top:4px; font-weight:bold;">
            ${station.inDomain ? "● IN OPERATIONAL DOMAIN" : "○ GATEWAY PORT"}
          </div>
        </div>
      `, {
        className: "custom-leaflet-popup",
        closeButton: false,
      });

      group.addLayer(marker);
    });

    group.addTo(map);

    return () => {
      map.removeLayer(group);
    };
  }, [stationsQ.data, showStations]);

  return (
    <MapContext.Provider value={{ map: mapInstance }}>
      <div className={`relative overflow-hidden ${className}`}>
        <div ref={containerRef} className="w-full h-full" />

        {/* HUD Overlay - Top Right Grid Status & Quick Actions */}
        <div className="absolute top-2 right-2 z-[1000] flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              mapRef.current?.flyTo([-67.8, 44.0], 4, { duration: 1.2 });
            }}
            className="bg-[#080e19]/90 hover:bg-[#0f1d30] border border-[#1e3a5f] hover:border-primary text-[#8aebff] px-2.5 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
            title="Recenter camera on the Antarctic passage corridor"
          >
            <Icon name="center_focus_strong" className="text-[13px] text-primary" />
            <span>FOCUS PASSAGE</span>
          </button>
          <div className="bg-[#080e19]/80 border border-[#16263c] backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-[#94a3b8] flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-status-safe animate-pulse"></span>
            <span className="font-bold text-[#f1f5f9]">EPSG:4326</span>
            <span className="text-[#64748b]">|</span>
            <span>ZOOM {currentZoom}</span>
          </div>
        </div>

        {/* HUD Overlay - Bottom Right Cursor Telemetry */}
        {showCoordinatesHud && cursorPos && (
          <div className="absolute bottom-2 right-2 pointer-events-none z-[1000]">
            <div className="bg-[#080e19]/90 border border-[#1e3a5f] backdrop-blur-md px-3 py-1.5 rounded shadow-lg flex items-center gap-2 text-[11px] font-mono">
              <Icon name="explore" className="text-primary text-[14px]" />
              <span className="text-[#94a3b8] text-[10px] font-semibold">CURSOR:</span>
              <span className="text-[#8aebff] font-bold">
                {coord(cursorPos.lat, cursorPos.lon)}
              </span>
            </div>
          </div>
        )}

        {/* Child layers mounted via MapContext */}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
}
