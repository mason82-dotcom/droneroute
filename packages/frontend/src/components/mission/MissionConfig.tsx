import { useMissionStore } from "@/store/missionStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import {
  speedLabel,
  heightLabel,
  toDisplaySpeed,
  fromDisplaySpeed,
  toDisplayHeight,
  fromDisplayHeight,
  speedRange,
} from "@/lib/units";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DRONE_MODELS, supportsThermal } from "@droneroute/shared";
import type {
  HeadingMode,
  FinishAction,
  RCLostAction,
  HeightMode,
  FlyToWaylineMode,
  ImageFormat,
} from "@droneroute/shared";
import { t } from "@/lib/i18n";

export function MissionConfig() {
  const { config, setConfig } = useMissionStore();
  const unitSystem = usePreferencesStore((s) => s.preferences.unitSystem);

  const selectedDrone = DRONE_MODELS.find(
    (d) =>
      d.droneEnumValue === config.droneEnumValue &&
      d.droneSubEnumValue === config.droneSubEnumValue,
  );

  return (
    <div className="p-3 space-y-3">
      <div>
        <Label className="text-xs">{t("Drone model")}</Label>
        <Select
          value={`${config.droneEnumValue}-${config.droneSubEnumValue}`}
          onValueChange={(v) => {
            const [drone, sub] = v.split("-").map(Number);
            const model = DRONE_MODELS.find(
              (d) => d.droneEnumValue === drone && d.droneSubEnumValue === sub,
            );
            if (model) {
              setConfig({
                droneEnumValue: model.droneEnumValue,
                droneSubEnumValue: model.droneSubEnumValue,
                payloadEnumValue: model.payloads[0]?.payloadEnumValue || 0,
                // a lens selection only applies to thermal payloads
                ...(supportsThermal(model.payloads[0]?.payloadEnumValue || 0)
                  ? {}
                  : { imageFormat: undefined }),
              });
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DRONE_MODELS.map((d) => (
              <SelectItem
                key={`${d.droneEnumValue}-${d.droneSubEnumValue}`}
                value={`${d.droneEnumValue}-${d.droneSubEnumValue}`}
              >
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDrone && selectedDrone.payloads.length > 1 && (
        <div>
          <Label className="text-xs">{t("Payload")}</Label>
          <Select
            value={String(config.payloadEnumValue)}
            onValueChange={(v) =>
              setConfig({
                payloadEnumValue: parseInt(v),
                ...(supportsThermal(parseInt(v))
                  ? {}
                  : { imageFormat: undefined }),
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectedDrone.payloads.map((p) => (
                <SelectItem
                  key={p.payloadEnumValue}
                  value={String(p.payloadEnumValue)}
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {supportsThermal(config.payloadEnumValue) && (
        <div>
          <Label className="text-xs">{t("Photo and video lenses")}</Label>
          <Select
            value={config.imageFormat || "default"}
            onValueChange={(v) =>
              setConfig({
                imageFormat: v === "default" ? undefined : (v as ImageFormat),
              })
            }
          >
            <SelectTrigger
              className="h-8 text-xs"
              title={t(
                "Which camera stores photos and videos (DJI payloadLensIndex)",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t("Drone default")}</SelectItem>
              <SelectItem value="visable">{t("Visible")}</SelectItem>
              <SelectItem value="ir">{t("Thermal")}</SelectItem>
              <SelectItem value="visable,ir">
                {t("Visible + thermal")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">
            Flight speed ({speedLabel(unitSystem)})
          </Label>
          <Input
            type="number"
            value={toDisplaySpeed(config.autoFlightSpeed, unitSystem)}
            onChange={(e) =>
              setConfig({
                autoFlightSpeed: fromDisplaySpeed(
                  parseFloat(e.target.value) || 1,
                  unitSystem,
                ),
              })
            }
            min={speedRange(unitSystem).min}
            max={speedRange(unitSystem).max}
            step={speedRange(unitSystem).step}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">
            Takeoff height ({heightLabel(unitSystem)})
          </Label>
          <Input
            type="number"
            value={toDisplayHeight(config.takeOffSecurityHeight, unitSystem)}
            onChange={(e) =>
              setConfig({
                takeOffSecurityHeight: fromDisplayHeight(
                  parseFloat(e.target.value) || 1.2,
                  unitSystem,
                ),
              })
            }
            min={1.2}
            max={1500}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">{t("Max battery (min)")}</Label>
        <Input
          type="number"
          value={config.maxBatteryMinutes}
          onChange={(e) =>
            setConfig({
              maxBatteryMinutes: Math.max(1, parseInt(e.target.value) || 1),
            })
          }
          min={1}
          max={120}
          step={1}
          className="h-8 text-xs"
        />
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {t("Warning when flight time exceeds this limit")}
        </div>
      </div>

      <div>
        <Label className="text-xs">{t("Height reference")}</Label>
        <Select
          value={config.heightMode}
          onValueChange={(v) => setConfig({ heightMode: v as HeightMode })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relativeToStartPoint">
              {t("Relative to start")}
            </SelectItem>
            <SelectItem value="aboveGroundLevel">
              {t("Above ground level")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">{t("Heading mode")}</Label>
        <Select
          value={config.globalHeadingMode}
          onValueChange={(v) =>
            setConfig({ globalHeadingMode: v as HeadingMode })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="followWayline">{t("Follow wayline")}</SelectItem>
            <SelectItem value="manually">{t("Manual")}</SelectItem>
            <SelectItem value="fixed">{t("Fixed")}</SelectItem>
            <SelectItem value="smoothTransition">
              {t("Smooth transition")}
            </SelectItem>
            <SelectItem value="towardPOI">{t("Toward POI")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">{t("Fly-to mode")}</Label>
        <Select
          value={config.flyToWaylineMode}
          onValueChange={(v) =>
            setConfig({ flyToWaylineMode: v as FlyToWaylineMode })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="safely">
              {t("Safely (climb then fly)")}
            </SelectItem>
            <SelectItem value="pointToPoint">
              {t("Point to point (direct)")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">{t("Finish action")}</Label>
        <Select
          value={config.finishAction}
          onValueChange={(v) => setConfig({ finishAction: v as FinishAction })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="goHome">{t("Go home")}</SelectItem>
            <SelectItem value="autoLand">{t("Auto land")}</SelectItem>
            <SelectItem value="gotoFirstWaypoint">
              {t("Go to first WP")}
            </SelectItem>
            <SelectItem value="noAction">{t("No action (hover)")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">{t("RC lost action")}</Label>
        <Select
          value={config.executeRCLostAction}
          onValueChange={(v) =>
            setConfig({ executeRCLostAction: v as RCLostAction })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="goBack">{t("Go back (RTH)")}</SelectItem>
            <SelectItem value="landing">{t("Land")}</SelectItem>
            <SelectItem value="hover">{t("Hover")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">
          Transit speed ({speedLabel(unitSystem)})
        </Label>
        <Input
          type="number"
          value={toDisplaySpeed(config.globalTransitionalSpeed, unitSystem)}
          onChange={(e) =>
            setConfig({
              globalTransitionalSpeed: fromDisplaySpeed(
                parseFloat(e.target.value) || 1,
                unitSystem,
              ),
            })
          }
          min={speedRange(unitSystem).min}
          max={speedRange(unitSystem).max}
          step={speedRange(unitSystem).step}
          className="h-8 text-xs"
        />
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {t("Speed to fly to first waypoint")}
        </div>
      </div>
    </div>
  );
}
