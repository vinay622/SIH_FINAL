import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ScalarField } from "../../lib/api";
import { usePolarisMap } from "./PolarisMap";

export interface SeaIceLayerProps {
  field?: ScalarField;
  opacity?: number;
  onCellClick?: (lat: number, lon: number, val: number | null) => void;
}

function concentrationToRgba(conc: number | null): [number, number, number, number] {
  if (conc === null || conc === undefined || isNaN(conc) || conc < 0.05) {
    return [0, 0, 0, 0]; // open ocean / transparent
  }
  if (conc <= 0.2) {
    return [3, 105, 161, 90]; // dark icy blue
  } else if (conc <= 0.5) {
    return [14, 165, 233, 140]; // bright cyan
  } else if (conc <= 0.8) {
    return [186, 230, 253, 190]; // pale ice blue
  } else {
    return [248, 250, 252, 230]; // dense consolidated ice / near white
  }
}

export function SeaIceLayer({
  field,
  opacity = 0.8,
  onCellClick,
}: SeaIceLayerProps) {
  const { map } = usePolarisMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    if (!map || !field) return;

    const { lats, lons, values } = field;
    if (!lats?.length || !lons?.length || !values?.length) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    const nLats = lats.length;
    const nLons = lons.length;

    const canvas = document.createElement("canvas");
    canvas.width = nLons;
    canvas.height = nLats;
    const ctx = canvas.getContext("2d");

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
        const row = values[rowIdx];
        if (!row) continue;

        for (let j = 0; j < nLons; j++) {
          const val = row[j];
          const [r, g, b, a] = concentrationToRgba(val);
          const pixelIndex = (i * nLons + j) * 4;
          buf[pixelIndex] = r;
          buf[pixelIndex + 1] = g;
          buf[pixelIndex + 2] = b;
          buf[pixelIndex + 3] = a;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const dlat = (latMax - latMin) / (nLats - 1 || 1);
      const dlon = (lonMax - lonMin) / (nLons - 1 || 1);
      const bounds: L.LatLngBoundsExpression = [
        [latMin - dlat / 2, lonMin - dlon / 2],
        [latMax + dlat / 2, lonMax + dlon / 2],
      ];

      const overlay = L.imageOverlay(canvas.toDataURL(), bounds, {
        opacity,
        interactive: true,
      });

      overlay.on("click", (e: L.LeafletMouseEvent) => {
        if (onCellClick) {
          onCellClick(e.latlng.lat, e.latlng.lng, null);
        }
      });

      overlay.addTo(map);
      overlayRef.current = overlay;
    }

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [map, field, opacity, onCellClick]);

  return null;
}
