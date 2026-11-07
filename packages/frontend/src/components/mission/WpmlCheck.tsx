import { useMemo } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  validateMission,
  type Mission,
  type ValidationIssue,
} from "@droneroute/shared";
import { useMissionStore } from "@/store/missionStore";
import { t } from "@/lib/i18n";

/** Checks the current mission against the DJI WPML reference (same rules as the KMZ export). */
export function useWpmlIssues(): ValidationIssue[] {
  const { config, waypoints, pois } = useMissionStore();
  return useMemo(
    () =>
      validateMission({
        id: "check",
        name: "check",
        createdAt: "",
        updatedAt: "",
        config,
        waypoints,
        pois,
        obstacles: [],
      } as Mission),
    [config, waypoints, pois],
  );
}

export function WpmlCheck({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("All fields match the DJI WPML reference")}
      </div>
    );
  }
  const sorted = [...issues].sort((a, b) =>
    a.level === b.level ? 0 : a.level === "error" ? -1 : 1,
  );
  return (
    <ul
      className="px-3 py-2 space-y-1.5 text-xs"
      aria-label={t("DJI WPML check results")}
    >
      {sorted.map((i, k) => (
        <li
          key={k}
          className={`flex gap-2 ${i.level === "error" ? "text-red-400" : "text-amber-400"}`}
        >
          {i.level === "error" ? (
            <AlertCircle
              className="h-3.5 w-3.5 shrink-0 mt-0.5"
              aria-label={t("Error")}
            />
          ) : (
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0 mt-0.5"
              aria-label={t("Warning")}
            />
          )}
          <span>
            <code className="text-[11px] text-foreground/80">{i.field}</code>{" "}
            {i.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
