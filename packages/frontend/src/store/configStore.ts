import { create } from "zustand";
import {
  DEFAULT_MAP_SOURCES,
  DEFAULT_MAP_VIEW,
  type MapSourcesConfig,
  type MapViewState,
} from "@droneroute/shared";
import { api } from "@/lib/api";

interface ConfigState {
  selfHosted: boolean;
  googleClientId: string | null;
  mapSources: MapSourcesConfig;
  /** Clients from trusted networks are signed in without a password. */
  trustedLogin: boolean;
  defaultMapView: MapViewState;
  loaded: boolean;
  fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  selfHosted: true,
  googleClientId: null,
  mapSources: DEFAULT_MAP_SOURCES,
  trustedLogin: false,
  defaultMapView: DEFAULT_MAP_VIEW,
  loaded: false,

  fetchConfig: async () => {
    try {
      const res = await api.get<{
        selfHosted: boolean;
        googleClientId?: string;
        mapSources?: MapSourcesConfig;
        trustedLogin?: boolean;
        defaultMapView?: MapViewState;
      }>("/config");
      set({
        selfHosted: res.selfHosted,
        googleClientId: res.googleClientId ?? null,
        mapSources: res.mapSources ?? DEFAULT_MAP_SOURCES,
        trustedLogin: res.trustedLogin ?? false,
        defaultMapView: res.defaultMapView ?? DEFAULT_MAP_VIEW,
        loaded: true,
      });
    } catch {
      // Fallback to self-hosted if config endpoint fails
      set({
        selfHosted: true,
        googleClientId: null,
        mapSources: DEFAULT_MAP_SOURCES,
        defaultMapView: DEFAULT_MAP_VIEW,
        loaded: true,
      });
    }
  },
}));
