# HousePlan Studio — Building Planner

A free, mobile-first, installable home floor-plan editor. Everything runs in your browser: no account, API key, database, or paid hosting service is required.

## Features

- Draw, select, resize, name, and measure rooms and walls on a feet-based grid.
- Align room corners and wall endpoints with magnetic guides; toggle **Align** to disable it. Adjacent rooms share one generated wall outline and one 3D wall face rather than overlapping copies.
- Place doors, windows, labels, and furniture.
- Place stairs and elevator shafts. They span toward the next level in 3D, with a matching opening in the floor slab above.
- Create, rename, duplicate, and switch between floors.
- On upper floors, toggle a dashed blue outline of the floor directly below to align rooms and vertical connections.
- Create named prefab objects with custom width, depth, height, and color. Reuse them from the Objects palette; templates are included in editable JSON exports.
- See all floors in an interactive 3D building model. Rotate, zoom, separate levels, or isolate one floor.
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

## Scope

HousePlan Studio is a conceptual design tool, not software for producing permitted, code-compliant, or engineer-approved architectural drawings. Dimensions and model geometry are approximate visualization aids; verify plans with qualified professionals before building.
