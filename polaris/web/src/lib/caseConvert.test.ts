import { describe, expect, it } from "vitest";
import { toCamelCase, toSnakeCase } from "./caseConvert";

describe("case conversion", () => {
  it("converts API payload keys recursively", () => {
    expect(toCamelCase({ mean_risk: 0.4, layers: [{ sea_ice_risk: 0.8 }] })).toEqual({ meanRisk: 0.4, layers: [{ seaIceRisk: 0.8 }] });
  });

  it("leaves GeoJSON geometry subtrees intact", () => {
    const geometry = { type: "Point", coordinates: [76.18, -69.4] };
    expect(toCamelCase({ observed_at: "now", geometry })).toEqual({ observedAt: "now", geometry });
  });

  it("converts request payloads to the backend convention", () => {
    expect(toSnakeCase({ forecastHours: 72, riskWeights: { seaIce: 0.4 } })).toEqual({ forecast_hours: 72, risk_weights: { sea_ice: 0.4 } });
  });
});
