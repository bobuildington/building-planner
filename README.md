# HousePlan Studio — Building Planner

A free, mobile-first, installable home floor-plan editor. Everything runs in your browser: no account, API key, database, or paid hosting service is required.

## Features

- Draw, select, resize, name, and measure rooms and walls on a feet-based grid.
- Place doors, windows, labels, and furniture.
- Create, rename, duplicate, and switch between floors.
- See all floors in an interactive 3D building model. Rotate, zoom, separate levels, isolate one floor, or show the roof.
- Phone controls: bottom drawing toolbar, furniture palette, expandable properties sheet, two-finger pan/zoom, and 3D pinch zoom.
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
2. Tap the **Install** banner shown in the editor and confirm. If Chrome doesn't show an installation prompt, open Chrome's **⋮** menu and choose **Install app** or **Add to Home screen**. You can also use **⋯ → Install on this phone** in the editor.
3. Open HousePlan from your phone's app launcher. The essential editor files are cached for offline use after initial installation.

## Back up your designs

Projects are saved automatically in the current browser's local storage. Clearing browser data, uninstalling the app, or using another device may remove or isolate them. Export **Editable project (.json)** regularly and import that file on another device or after reinstalling.

If you were using an earlier ChatGPT-hosted version, export a JSON backup there and import it here; browser storage does not transfer automatically between different website addresses.

## Scope

HousePlan Studio is a conceptual design tool, not software for producing permitted, code-compliant, or engineer-approved architectural drawings. Dimensions and model geometry are approximate visualization aids; verify plans with qualified professionals before building.
