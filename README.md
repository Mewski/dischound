# Dischound

Discord friend graph visualizer with Bloodhound-style collection. Run the Howl collector in your Discord browser console to map your friend network with cluster detection and bridging analysis.

## Setup

```sh
bun install
bun run dev
```

## Usage

1. Open <http://localhost:5173>
2. Click **Collect new data** in the sidebar
3. Copy the Howl script and paste it into Discord's browser console (F12 → Console)
4. Wait for collection to finish (progress logs in the console)
5. Refresh the page — the graph loads from the ingested data

## Features

- **Force-directed graph** — D3 simulation with per-cluster grouping and convex hulls
- **Two clustering modes** — switch between mutual-friend-based (label propagation) and server-based clustering
- **Bridging analysis** — identifies users who bridge multiple clusters
- **Search** — filter nodes by username or display name
- **Dark/light theme** — toggle in the sidebar header
- **Cluster visibility** — click clusters in the sidebar to show/hide them
- **Hover tooltips** — shows user details, cluster, bridging score, mutual/server counts
- **Local caching** — graph data persists in localStorage for 1 hour

## Build

```sh
bun run build
```

Output goes to `build/` as a static SPA (client-side only, no SSR).

## Project structure

```
static/
  howl.js               Howl collector (runs in Discord console)
src/
  lib/
    ForceGraph.svelte   D3 force-directed graph with zoom, drag, hulls
    Sidebar.svelte      Stats, search, cluster list, bridging risks
    SearchBar.svelte    Real-time username search
    Tooltip.svelte      Hover tooltip with node details
    FetchPanel.svelte   Collector modal with syntax-highlighted script
    discord-fetch.ts    Data processing, clustering, bridging scores
    graph-utils.ts      Edge building, hull computation, color utilities
    theme.svelte.ts     Dark/light mode state
    types.ts            TypeScript interfaces
  routes/
    +page.svelte        Main page orchestrating all components
    +layout.svelte      Root layout with theme init
    api/ingest/         In-memory POST/GET endpoint for collector data
```

## Tech stack

- [SvelteKit](https://svelte.dev) with static adapter
- [D3.js](https://d3js.org) for force simulation and hulls
- [Tailwind CSS](https://tailwindcss.com) v4
- TypeScript

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
