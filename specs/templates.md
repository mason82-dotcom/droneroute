# Templates

Create common flight patterns automatically instead of placing waypoints one by one.

## What you can do

- **Orbit**: fly a circular path around a center point. Choose radius, number of waypoints, and direction (clockwise or counter-clockwise).
- **Grid survey**: fly a back-and-forth zigzag pattern over an area. Useful for mapping or photogrammetry.
  - **Orthomosaic mode**: set front and side overlap in percent. The app uses the camera of the mission drone and
    payload, asks you to confirm that model, computes the line and photo spacing, shows the ground resolution and
    estimated photo count, and places a photo waypoint at every shot.
- **Facade scan**: fly a vertical scanning pattern along a building face. Useful for inspections.
- **Pencil path**: draw a freehand path on the map and the app places evenly spaced waypoints along it.

## How it works

1. Select a template from the toolbar or press its shortcut key (O for orbit, G for grid, F for facade, Z for pencil).
2. Configure the template options in the panel that appears.
3. Click on the map to place the template.
4. The generated waypoints appear in the sidebar and can be edited individually.

## Good to know

- You can combine templates — for example, use a grid survey and then add an orbit around a specific structure.
- Orthomosaic mode needs a payload with a known mapping camera (all listed drones except H20N and PSDK). Spacing
  assumes flat ground at the set altitude above takeoff.
- All generated waypoints behave like normal waypoints after placement. You can move, delete, or change their settings.
