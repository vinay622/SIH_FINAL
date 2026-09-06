import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VesselProfile } from "../lib/types";

export const VALID_ICE_CLASSES = [
  "none",
  "1c",
  "1b",
  "1a",
  "1a_super",
  "pc5",
  "icebreaker",
] as const;

export const DEFAULT_VESSEL: VesselProfile = {
  name: "R/V POLAR STERN",
  iceClass: "1a_super",
  iceCapability: 0.82,
  speedKnots: 12.0,
  fuelConsumptionTpd: 25.0,
  draftM: 7.0,
  riskTolerance: 0.3,
};

interface VesselContextValue {
  vessel: VesselProfile;
  setVessel: (v: VesselProfile | ((prev: VesselProfile) => VesselProfile)) => void;
  updateVessel: (patch: Partial<VesselProfile>) => void;
  resetVessel: () => void;
}

const VesselContext = createContext<VesselContextValue>({
  vessel: DEFAULT_VESSEL,
  setVessel: () => {},
  updateVessel: () => {},
  resetVessel: () => {},
});

const STORAGE_KEY = "polaris_vessel_profile";

export function VesselProvider({ children }: { children: ReactNode }) {
  const [vessel, setVessel] = useState<VesselProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize legacy or invalid iceClass strings
        if (!VALID_ICE_CLASSES.includes(parsed.iceClass?.toLowerCase?.())) {
          parsed.iceClass = "1a_super";
        }
        return { ...DEFAULT_VESSEL, ...parsed };
      }
    } catch {
      // ignore JSON parse error
    }
    return DEFAULT_VESSEL;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vessel));
    } catch {
      // ignore storage error
    }
  }, [vessel]);

  const updateVessel = (patch: Partial<VesselProfile>) => {
    setVessel((prev) => ({ ...prev, ...patch }));
  };

  const resetVessel = () => {
    setVessel(DEFAULT_VESSEL);
  };

  return (
    <VesselContext.Provider value={{ vessel, setVessel, updateVessel, resetVessel }}>
      {children}
    </VesselContext.Provider>
  );
}

export function useVessel() {
  return useContext(VesselContext);
}
