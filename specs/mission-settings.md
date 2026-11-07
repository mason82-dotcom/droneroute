# Mission settings

Configure your drone model, camera, altitude reference, and safety options for the mission.

## What you can do

- **Choose your drone model**: M300 RTK, M350 RTK, M30/M30T, M30 Dock, Mavic 3E/3T/3M/3D/3TD, Mini 4 Pro.
- **Choose a camera/payload** available for the selected drone.
- **Set a global flight speed** and takeoff security height.
- **Choose a height reference**:
  - Relative to start point.
  - EGM96 (MSL) — altitude above mean sea level.
  - Above ground level.
- **Set what happens when the mission ends**: go home, land automatically, return to the first waypoint, or hover.
- **Set what happens if the remote controller connection is lost**: return home, land, or hover.
- **Set the transit speed** (speed used to fly to the first waypoint).
- **Set maximum battery minutes** so the app can warn you if the estimated flight time exceeds your battery capacity.

## How it works

1. Open the mission settings panel in the sidebar.
2. Select your drone and camera.
3. Adjust altitude reference, speeds, and safety options.
4. The app uses these settings when exporting the mission file and when calculating flight time estimates.

## Good to know

- The available cameras change depending on which drone you select.
- If the estimated flight time exceeds the battery limit you set, a warning appears.
- Height reference affects how altitude values are interpreted by the drone — choose the one that matches your operational needs. The default is **relative to start** (relative to the takeoff point): DJI documents _above ground level_ as FlightHub 2 only, so DJI Pilot 2 and DJI Fly would not fly it as planned.
- All height fields enforce a minimum of 1 meter.
- For drones with a thermal camera (M3T, M3TA, M4T, M30T, M3TD, H20T, H30T) you can choose which lenses store photos and videos: visible, thermal or both. This is written the same way DJI Pilot 2 writes it.
- **DJI check**: below the settings, every field is checked against the DJI WPML reference (value ranges, allowed values, required combinations such as turn distances shorter than the segment). Errors block the KMZ export; warnings (for example _above ground level_, which DJI only supports in FlightHub 2, not in DJI Pilot 2) are shown but do not block it.
- You can set default values for all mission settings in the **Mission defaults** tab of the settings dialog. New missions will use those defaults instead of the factory defaults.
