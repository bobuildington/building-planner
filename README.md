# HousePlan Studio — Building Planner

A free, mobile-first, installable home floor-plan editor. Everything runs in your browser: no account, API key, database, or paid hosting service is required.

## Features

- Draw, select, resize, name, and measure rooms and walls on a feet-based grid.
- Align room corners and wall endpoints with magnetic guides; toggle **Align** to disable it. Adjacent rooms share one generated wall outline and one 3D wall face rather than overlapping copies.
- Place doors, windows, labels, and furniture.
- Doors and windows cut real openings in the 3D wall mesh. Windows show a sill, lintel, and translucent glass; doors show a walk-through gap and an angled door leaf.
- Place stairs and elevator shafts. They span toward the next level in 3D, with a matching opening in the floor slab above.
- Elevator shafts can extend through **all floors above** or just the **next floor** (choose in the elevator's Properties). Upper-floor 2D plans show non-editable shaft and stairwell opening guides.
- Create, rename, duplicate, and switch between floors.
- On upper floors, toggle a dashed blue outline of the floor below, magnetically **Align below**, or tap **Trace rooms** to copy missing room/wall outlines as editable elements. Trace never removes the existing layout and can be undone.
- Create named prefab objects with categories, custom dimensions, colors, and procedural 3D shapes (box, table, shelf, cabinet, or cylinder). Optionally import a local **OBJ** or uncompressed **glTF 2.0 GLB** mesh. Models are included in JSON exports and backups.
- Set a floor finish and wall finish on each room in the Properties inspector; the 2D floor colors and 3D room surfaces update together. For shared walls, the first connected room supplies the finish.
- See all floors in an interactive 3D building model with thicker wall faces, framed wall openings, and connected vertical shafts. Rotate, zoom, separate levels, or isolate one floor.
- Tap **Walk inside** in 3D to enter a first-person walkthrough. On phones, drag to look and use the directional arrows; on desktop use **W/A/S/D** or arrow keys. Switch the walkthrough floor in its menu, then select **Exit walk** to return to the building view.
- Phone controls: bottom drawing toolbar, scrolling Objects palette, expandable properties sheet, larger touch handles, one-tap Edit / Copy / Rotate / Delete actions, two-finger pan/zoom, and 3D pinch zoom.
- Create as many separate house projects as local storage allows. Open **Projects / My projects** to switch, duplicate, recover an earlier save, or delete a design. Importing a project creates a new saved copy.
- Download an all-project JSON backup from **My projects → Back up all**. Restore it later without deleting existing projects.
- Undo/redo, local autosave, and PNG, SVG, editable JSON, or print-to-PDF export.
- Installable Progressive Web App (PWA) with offline caching after the first online visit.

## Run locally

This is a buildless HTML/CSS/JavaScript app. For a local preview, serve the folder using any HTTP server, such as `python -m http.server 8080`, and open `http://localhost:8080/`. Browsing the files directly with `file://` is not recommended for the install/offline features.

## Publish free with GitHub Pages

1. Push these files to the root of the `main` branch in your GitHub repository.
2. Open **Settings → Pages** in that repository.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then save.
5. Wait for GitHub to show the published URL. For this repository it should be `https://bobuildington.github.io/building-planner/`.

GitHub Pages on a free account requires a public repository. The source code is public, **but house designs are not pushed to the repository**.

## Install on Android

1. Open the published site in Chrome.
2. Open Chrome's **⋮** menu and choose **Install app** or **Add to Home screen**, then confirm. Installation is provided by the browser; the editor does not display its own install button.
3. Open HousePlan from your phone's app launcher. The essential editor files are cached for offline use after initial installation.

## Back up your designs

Each project is saved automatically in a separate browser-local document, with a recoverable earlier version when available. The app also requests persistent storage when you open the project library (the browser may decline). Clearing browser data, uninstalling the app, or using another device may still remove or isolate these files. Use **My projects → Back up all** regularly, and keep the downloaded JSON in a safe place. You can also export just one design using **Export → Editable project**.

If you were using an earlier ChatGPT-hosted version, export a JSON backup there and import it here; browser storage does not transfer automatically between different website addresses.

## Imported model compatibility

- OBJ files use vertices (`v`) and polygon faces (`f`). GLB files must be uncompressed glTF 2.0 with embedded meshes, float position coordinates, and basic triangle indices. Scene-node transforms are supported; Draco/meshopt compression, texture maps, and external `.gltf` references are not supported.
- Imported models are normalized to the dimensions you set in the prefab form. Use models under **1 MB**, **900 triangles**, and **3,000 vertices** to keep rendering usable on modest phones. Use a 3D modeling editor to decimate more detailed models.
- A copy of the mesh is stored in each placed instance so removing a prefab from the library does not remove already-placed models. Large numbers of copies consume browser-local storage; export backups regularly.
- Walkthrough is a visual preview with room-footprint movement limits, not a physically accurate game engine, collision simulation, or architectural safety check.

## Scope

HousePlan Studio is a conceptual design tool, not software for producing permitted, code-compliant, or engineer-approved architectural drawings. Dimensions and model geometry are approximate visualization aids; verify plans with qualified professionals before building.
