import {
  MousePointerClick,
  Hand,
  Trash2,
  Crosshair,
  Orbit,
  Grid3X3,
  Building2,
  PenLine,
  ChevronDown,
  Triangle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMissionStore } from "@/store/missionStore";
import type { TemplateType } from "@/lib/templates";
import { t } from "@/lib/i18n";

const activeClass =
  "bg-primary text-primary-foreground ring-2 ring-primary/50 shadow-lg shadow-primary/20 hover:bg-primary/90";
const inactiveClass = "bg-background/90 backdrop-blur-sm";

const TEMPLATE_OPTIONS: {
  type: TemplateType;
  label: string;
  shortLabel: string;
  icon: typeof Orbit;
  description: string;
  key: string;
}[] = [
  {
    type: "orbit",
    label: t("Orbit"),
    shortLabel: t("Orbit"),
    icon: Orbit,
    description: t("Circle around a point"),
    key: "O",
  },
  {
    type: "grid",
    label: t("Grid survey"),
    shortLabel: t("Grid"),
    icon: Grid3X3,
    description: t("Lawn-mower scan area"),
    key: "G",
  },
  {
    type: "facade",
    label: t("Facade scan"),
    shortLabel: t("Facade"),
    icon: Building2,
    description: t("Vertical wall scan"),
    key: "F",
  },
  {
    type: "pencil",
    label: t("Pencil path"),
    shortLabel: t("Pencil"),
    icon: PenLine,
    description: t("Draw a freehand path"),
    key: "Z",
  },
];

export function MapToolbar() {
  const {
    isAddingWaypoint,
    isAddingPoi,
    isDrawingObstacle,
    templateMode,
    setIsAddingWaypoint,
    setIsAddingPoi,
    setIsDrawingObstacle,
    setTemplateMode,
    waypoints,
    pois,
    obstacles,
    clearMission,
  } = useMissionStore();

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplateMenu]);

  const isPanning =
    !isAddingWaypoint && !isAddingPoi && !isDrawingObstacle && !templateMode;

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 min-w-[130px]">
      <Button
        variant={isAddingWaypoint ? "default" : "outline"}
        size="sm"
        onClick={() => setIsAddingWaypoint(true)}
        title={t("Click on map to add waypoints (W)")}
        className={`justify-between ${isAddingWaypoint ? activeClass : inactiveClass}`}
      >
        <span className="flex items-center gap-1.5">
          <MousePointerClick className="h-4 w-4" />
          <span className="text-xs">{t("Add WP")}</span>
        </span>
        <kbd className="text-[10px] font-mono font-bold border border-border bg-secondary px-1.5 py-0.5 rounded text-foreground/80">
          W
        </kbd>
      </Button>
      <Button
        variant={isAddingPoi ? "default" : "outline"}
        size="sm"
        onClick={() => setIsAddingPoi(true)}
        title={t("Click on map to add POI (P)")}
        className={`justify-between ${isAddingPoi ? activeClass : inactiveClass}`}
      >
        <span className="flex items-center gap-1.5">
          <Crosshair className="h-4 w-4" />
          <span className="text-xs">{t("Add POI")}</span>
        </span>
        <kbd className="text-[10px] font-mono font-bold border border-border bg-secondary px-1.5 py-0.5 rounded text-foreground/80">
          P
        </kbd>
      </Button>
      <Button
        variant={isDrawingObstacle ? "default" : "outline"}
        size="sm"
        onClick={() => setIsDrawingObstacle(!isDrawingObstacle)}
        title={t("Draw obstacle polygon (B)")}
        className={`justify-between ${isDrawingObstacle ? activeClass : inactiveClass}`}
      >
        <span className="flex items-center gap-1.5">
          <Triangle className="h-4 w-4" />
          <span className="text-xs">{t("Obstacle")}</span>
        </span>
        <kbd className="text-[10px] font-mono font-bold border border-border bg-secondary px-1.5 py-0.5 rounded text-foreground/80">
          B
        </kbd>
      </Button>

      {/* Template dropdown */}
      <div className="relative" ref={menuRef}>
        <Button
          variant={templateMode ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTemplateMenu(!showTemplateMenu)}
          title={t("Insert a mission template")}
          className={`justify-between w-full ${templateMode ? activeClass : inactiveClass}`}
        >
          <span className="flex items-center gap-1.5">
            {templateMode === "orbit" ? (
              <Orbit className="h-4 w-4" />
            ) : templateMode === "grid" ? (
              <Grid3X3 className="h-4 w-4" />
            ) : templateMode === "facade" ? (
              <Building2 className="h-4 w-4" />
            ) : templateMode === "pencil" ? (
              <PenLine className="h-4 w-4" />
            ) : (
              <Grid3X3 className="h-4 w-4" />
            )}
            <span className="text-xs">
              {templateMode
                ? TEMPLATE_OPTIONS.find((t) => t.type === templateMode)
                    ?.shortLabel
                : t("Template")}
            </span>
          </span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>

        {showTemplateMenu && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-card/95 backdrop-blur-sm border border-border rounded-md shadow-lg overflow-hidden z-50">
            {TEMPLATE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = templateMode === opt.type;
              return (
                <button
                  key={opt.type}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors ${isActive ? "bg-accent text-accent-foreground" : ""}`}
                  onClick={() => {
                    setTemplateMode(opt.type);
                    setShowTemplateMenu(false);
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="text-left flex-1">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {opt.description}
                    </div>
                  </div>
                  <kbd className="text-[10px] font-mono font-bold border border-border bg-secondary px-1.5 py-0.5 rounded text-foreground/80 shrink-0">
                    {opt.key}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button
        variant={isPanning ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setIsAddingWaypoint(false);
          setIsAddingPoi(false);
          setIsDrawingObstacle(false);
          setTemplateMode(null);
        }}
        title={t("Pan / select mode (Esc)")}
        className={`justify-between ${isPanning ? activeClass : inactiveClass}`}
      >
        <span className="flex items-center gap-1.5">
          <Hand className="h-4 w-4" />
          <span className="text-xs">{t("Pan")}</span>
        </span>
        <kbd className="text-[10px] font-mono font-bold border border-border bg-secondary px-1.5 py-0.5 rounded text-foreground/80">
          {t("Esc")}
        </kbd>
      </Button>
      {(waypoints.length > 0 || pois.length > 0 || obstacles.length > 0) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("Clear all waypoints, POIs, and obstacles?"))
              clearMission();
          }}
          title={t("Clear all waypoints, POIs, and obstacles")}
          className="bg-background/90 backdrop-blur-sm text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-xs">{t("Clear")}</span>
        </Button>
      )}
    </div>
  );
}
