import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getWeatherStations,
  getWeatherCurrent,
  getWeatherPoint,
} from "../lib/api";
import { coord, num } from "../lib/format";
import { Busy, Failure, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";

export function WeatherOcean() {
  const [selectedStationKey, setSelectedStationKey] = useState<string>("bharati");
  const [pointCoords, setPointCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Weather stations query
  const stationsQ = useQuery({
    queryKey: ["weather", "stations"],
    queryFn: () => getWeatherStations({ forecastHours: 48 }),
    staleTime: 60_000,
  });

  // Layer freshness
  const liveQ = useQuery({
    queryKey: ["weather", "current"],
    queryFn: () => getWeatherCurrent(),
    staleTime: 60_000,
  });

  // Optional point query on map click
  const pointQ = useQuery({
    queryKey: ["weather", "point", pointCoords?.lat, pointCoords?.lon],
    queryFn: () => getWeatherPoint(pointCoords!.lat, pointCoords!.lon),
    enabled: Boolean(pointCoords),
    staleTime: 60_000,
  });

  if (stationsQ.isError) {
    return (
      <Failure
        message="WEATHER & OCEAN TELEMETRY OFFLINE"
        hint="Failed to contact polar meteorological and ocean dynamics service."
      />
    );
  }

  const stations = stationsQ.data?.stations ?? [];
  const selectedStation =
    stations.find((s) => s.station.toLowerCase() === selectedStationKey.toLowerCase()) ??
    stations[0];

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Command Synoptic Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-safe animate-pulse" />
            <span className="font-headline-sm text-headline-sm text-text-primary font-bold uppercase">
              TACTICAL METEOROLOGY & OCEAN DYNAMICS
            </span>
          </div>
          <span className="text-text-muted">|</span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            MODEL: <strong className="text-primary">ECMWF + POLAR-WRF v5.4</strong>
          </span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            SYNOPTIC FEED: <strong className="text-status-safe">99.1% ASSIMILATION SYNC</strong>
          </span>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <Pill level="telemetry">ATMOS + HYDRO</Pill>
          <Pill level={selectedStation?.freezingSprayRisk === "none" ? "safe" : "danger"}>
            SPRAY RISK: {selectedStation?.freezingSprayRisk?.toUpperCase() ?? "NOMINAL"}
          </Pill>
        </div>
      </div>

      {/* 6 High-Density Environmental Condition Gauges */}
      {selectedStation && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter-sm">
          {/* Wind Velocity */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">WIND VELOCITY</span>
              <Icon name="air" className="text-primary text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span className="font-stat-metric text-stat-metric text-text-primary">
                {num(selectedStation.windSpeedM, 1)}
              </span>
              <span className="font-mono text-[11px] text-text-muted">m/s</span>
              <span className="text-primary font-bold ml-auto font-mono text-[12px]">
                {num(selectedStation.windDirectionDeg, 0)}°
              </span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>BEAUFORT:</span>
              <span className="text-text-primary font-bold">F{selectedStation.beaufortForce}</span>
            </div>
          </div>

          {/* Air Temperature */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">AIR TEMPERATURE</span>
              <Icon name="device_thermostat" className="text-status-telemetry text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span
                className={`font-stat-metric text-stat-metric ${
                  selectedStation.airTemperatureC < -15 ? "text-status-telemetry" : "text-text-primary"
                }`}
              >
                {selectedStation.airTemperatureC.toFixed(1)}
              </span>
              <span className="font-mono text-[11px] text-text-muted">°C</span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>HUMIDITY:</span>
              <span className="text-text-primary font-bold">{selectedStation.relativeHumidityPct}%</span>
            </div>
          </div>

          {/* Sea Surface Temp */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">SEA SURFACE TEMP</span>
              <Icon name="water" className="text-primary text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span className="font-stat-metric text-stat-metric text-primary">
                {selectedStation.seaSurfaceTemperatureC.toFixed(1)}
              </span>
              <span className="font-mono text-[11px] text-text-muted">°C</span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>FREEZING PT:</span>
              <span className="text-text-secondary font-bold">-1.8°C</span>
            </div>
          </div>

          {/* Significant Wave Height */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">WAVE HEIGHT</span>
              <Icon name="tsunami" className="text-secondary text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span className="font-stat-metric text-stat-metric text-text-primary">
                {selectedStation.significantWaveHeightM !== null
                  ? num(selectedStation.significantWaveHeightM, 1)
                  : "0.0"}
              </span>
              <span className="font-mono text-[11px] text-text-muted">m</span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>PERIOD:</span>
              <span className="text-text-primary font-bold">
                {selectedStation.wavePeriodS !== null ? `${selectedStation.wavePeriodS}s` : "—"}
              </span>
            </div>
          </div>

          {/* Ocean Current */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">OCEAN CURRENT</span>
              <Icon name="explore" className="text-status-safe text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span className="font-stat-metric text-stat-metric text-status-safe">
                {num(selectedStation.oceanCurrentSpeedM, 2)}
              </span>
              <span className="font-mono text-[11px] text-text-muted">m/s</span>
              <span className="text-primary font-bold ml-auto font-mono text-[12px]">
                {num(selectedStation.oceanCurrentDirectionDeg, 0)}°
              </span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>PRYDZ GYRE:</span>
              <span className="text-text-primary font-bold">EASTWARD</span>
            </div>
          </div>

          {/* Barometric Pressure */}
          <div className="bg-surface-panel p-panel-pad-default rounded border border-border-subtle flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-muted">MSL PRESSURE</span>
              <Icon name="speed" className="text-status-caution text-[18px]" />
            </div>
            <div className="my-1 flex items-baseline gap-1">
              <span className="font-stat-metric text-stat-metric text-text-primary">
                {num(selectedStation.meanSeaLevelPressureHpa, 0)}
              </span>
              <span className="font-mono text-[11px] text-text-muted">hPa</span>
            </div>
            <div className="text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle flex justify-between">
              <span>CLOUD COVER:</span>
              <span className="text-text-primary font-bold">{selectedStation.cloudCoverPct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Map & Weather Telemetry Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md items-start">
        {/* Central Map Viewport (7 cols) */}
        <div className="xl:col-span-7 flex flex-col min-w-0">
          <Panel
            label="SYNOPTIC WEATHER & SURFACE OCEAN MAP"
            icon="public"
            right={
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-text-muted">
                  CLICK ANY POINT FOR MARINE METOC PROFILE
                </span>
              </div>
            }
            className="h-[640px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            <PolarisMap
              center={
                selectedStation
                  ? [selectedStation.latitude, selectedStation.longitude]
                  : [-68, 50]
              }
              zoom={4}
              onPointClick={(lat, lon) => setPointCoords({ lat, lon })}
              className="w-full h-full min-h-[500px]"
            />

            {/* Clicked Point Weather Popup Card */}
            {pointCoords && (
              <div className="absolute top-3 left-3 z-[1000] w-72 bg-[#080e19]/95 border border-primary p-panel-pad-compact rounded shadow-2xl backdrop-blur-md font-mono text-[11px]">
                <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                  <span className="text-primary font-bold">POINT METOC SOUNDING</span>
                  <button
                    type="button"
                    onClick={() => setPointCoords(null)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[10px] text-text-muted mt-1">
                  {coord(pointCoords.lat, pointCoords.lon)}
                </div>

                {pointQ.isLoading ? (
                  <div className="py-2"><Busy label="FETCHING OCEAN GRID..." /></div>
                ) : pointQ.data ? (
                  <div className="flex flex-col gap-1 mt-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Air Temp:</span>
                      <span className="text-text-primary font-bold">
                        {pointQ.data.airTemperatureC.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Wind Speed:</span>
                      <span className="text-primary font-bold">
                        {num(pointQ.data.windSpeedM, 1)} m/s ({num(pointQ.data.windDirectionDeg, 0)}°)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Sea Temp:</span>
                      <span className="text-text-primary">
                        {pointQ.data.seaSurfaceTemperatureC.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Waves:</span>
                      <span className="text-text-primary">
                        {num(pointQ.data.significantWaveHeightM, 1)} m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Spray Risk:</span>
                      <span className="text-status-safe font-bold">
                        {pointQ.data.freezingSprayRisk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
        </div>

        {/* Right Station Feeds & Forecast Column (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-gutter-md min-w-0">
          {/* Station Selector Tabs */}
          <div className="flex items-center gap-2">
            {stations.map((st) => (
              <button
                key={st.station}
                type="button"
                onClick={() => setSelectedStationKey(st.station)}
                className={`flex-1 py-2 px-3 rounded border font-mono text-[12px] font-bold transition-colors ${
                  selectedStationKey.toLowerCase() === st.station.toLowerCase()
                    ? "bg-primary text-[#00363e] border-primary shadow-[0_0_10px_rgba(138,235,255,0.35)]"
                    : "bg-surface-panel text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-active"
                }`}
              >
                {st.displayName.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Station Hourly Forecast Timeline */}
          {selectedStation && selectedStation.forecast && (
            <Panel label={`${selectedStation.displayName.toUpperCase()} 48H FORECAST`} icon="schedule">
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-mono text-text-muted">
                  Hourly synoptic forecast timeline:
                </div>
                <div className="max-h-[220px] overflow-y-auto border border-border-subtle rounded bg-surface-container-lowest">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-surface-raised border-b border-border-subtle text-text-muted text-[10px]">
                      <tr>
                        <th className="py-1 px-2">VALID AT</th>
                        <th className="py-1 px-2">TEMP</th>
                        <th className="py-1 px-2">WIND</th>
                        <th className="py-1 px-2 text-right">PRESSURE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {selectedStation.forecast.slice(0, 12).map((fc, i) => (
                        <tr key={i} className="hover:bg-surface-container-high/40">
                          <td className="py-1 px-2 text-text-secondary">
                            {fc.validAt.substring(11, 16)} UTC
                          </td>
                          <td className="py-1 px-2 text-status-telemetry font-bold">
                            {fc.airTemperatureC.toFixed(1)}°C
                          </td>
                          <td className="py-1 px-2 text-text-primary">
                            {num(fc.windSpeedM, 1)} m/s ({num(fc.windDirectionDeg, 0)}°)
                          </td>
                          <td className="py-1 px-2 text-right text-text-muted">
                            {num(fc.meanSeaLevelPressureHpa, 0)} hPa
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          )}

          {/* Layer Freshness Panel */}
          <Panel label="TELEMETRY LAYER FRESHNESS" icon="history">
            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {liveQ.data?.layers ? (
                Object.entries(liveQ.data.layers).map(([layerName, layerInfo]) => (
                  <div
                    key={layerName}
                    className="flex items-center justify-between p-2 bg-surface-container-lowest border border-border-subtle rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-status-safe" />
                      <span className="font-bold text-text-primary uppercase">{layerName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-status-safe font-bold">
                        {layerInfo.ageHours.toFixed(1)}h ago
                      </span>
                      <span className="text-[10px] text-text-muted ml-2">
                        ({layerInfo.observedAt?.substring(11, 16)} UTC)
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-text-muted">
                  Loading layer sync status...
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
