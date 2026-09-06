import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHealth, getIcebergs, getRiskMap } from "../lib/api";
import { coord, num, pct } from "../lib/format";

export interface TacticalAlert {
  id: string;
  severity: "critical" | "warning" | "advisory";
  category: "collision" | "ice_risk" | "system" | "weather";
  title: string;
  description: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  acknowledged: boolean;
}

export function useAlerts() {
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000,
  });

  const riskQ = useQuery({
    queryKey: ["risk", "map", { horizon: 0, stride: 4 }],
    queryFn: () => getRiskMap({ horizon: 0, stride: 4 }),
    refetchInterval: 60_000,
  });

  const icebergsQ = useQuery({
    queryKey: ["icebergs"],
    queryFn: () => getIcebergs(),
    refetchInterval: 60_000,
  });

  const alerts = useMemo<TacticalAlert[]>(() => {
    const list: TacticalAlert[] = [];
    const now = new Date().toISOString();

    // 1. Iceberg drift warnings
    if (icebergsQ.data?.icebergs) {
      icebergsQ.data.icebergs.forEach((berg) => {
        if (berg.inDomain && berg.driftSpeedM >= 0.15) {
          list.push({
            id: `iceberg-${berg.icebergId}`,
            severity: berg.driftSpeedM > 0.3 ? "critical" : "warning",
            category: "collision",
            title: `ICEBERG INTERCEPT HAZARD — ${berg.icebergId}`,
            description: `Tracked berg drifting at ${num(berg.driftSpeedM, 2)} m/s (heading ${num(berg.driftBearingDeg, 0)}°). Area ${num(berg.areaKm2, 1)} km².`,
            timestamp: berg.observedAt || now,
            latitude: berg.latitude,
            longitude: berg.longitude,
            acknowledged: acknowledgedIds.has(`iceberg-${berg.icebergId}`),
          });
        }
      });
    }

    // 2. Risk hotspot corridors
    if (riskQ.data?.hotspots) {
      riskQ.data.hotspots.forEach((spot, idx) => {
        if (spot.totalRisk >= 0.70) {
          list.push({
            id: `risk-hotspot-${idx}-${spot.latitude.toFixed(2)}-${spot.longitude.toFixed(2)}`,
            severity: spot.totalRisk >= 0.85 ? "critical" : "warning",
            category: "ice_risk",
            title: `SEVERE RISK ZONE #${idx + 1} (${pct(spot.totalRisk, 0)})`,
            description: `Navigational passage blocked/impeded at ${coord(spot.latitude, spot.longitude)}. Dominant stress: ${spot.dominantComponent.toUpperCase()}.`,
            timestamp: riskQ.data.summary?.generatedAt || now,
            latitude: spot.latitude,
            longitude: spot.longitude,
            acknowledged: acknowledgedIds.has(`risk-hotspot-${idx}-${spot.latitude.toFixed(2)}-${spot.longitude.toFixed(2)}`),
          });
        }
      });
    }

    // 3. System health alerts
    if (healthQ.data?.components) {
      healthQ.data.components.forEach((c) => {
        if (c.status !== "ok") {
          list.push({
            id: `health-${c.name}`,
            severity: c.status === "error" ? "critical" : "advisory",
            category: "system",
            title: `SUBSYSTEM DEGRADATION — ${c.name.toUpperCase()}`,
            description: `Component status reported as ${c.status.toUpperCase()}: ${c.detail}`,
            timestamp: healthQ.data.timestamp || now,
            acknowledged: acknowledgedIds.has(`health-${c.name}`),
          });
        }
      });
    }

    // 4. Missing risk layer alerts
    if (riskQ.data?.summary?.missingLayers?.length) {
      riskQ.data.summary.missingLayers.forEach((layer) => {
        list.push({
          id: `missing-layer-${layer}`,
          severity: "advisory",
          category: "system",
          title: `DATA LAYER GAP: ${layer.toUpperCase()}`,
          description: `The risk synthesis engine is running with ${layer} fallback models due to missing telemetry feed.`,
          timestamp: riskQ.data.summary.generatedAt || now,
          acknowledged: acknowledgedIds.has(`missing-layer-${layer}`),
        });
      });
    }

    return list;
  }, [healthQ.data, riskQ.data, icebergsQ.data, acknowledgedIds]);

  const activeCount = alerts.filter((a) => !a.acknowledged).length;

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearAll = () => {
    setAcknowledgedIds(new Set(alerts.map((a) => a.id)));
  };

  return {
    alerts,
    activeCount,
    isLoading: healthQ.isLoading || riskQ.isLoading || icebergsQ.isLoading,
    toggleAcknowledge,
    clearAll,
  };
}
