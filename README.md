# Dischound

Discord friend graph visualizer with Bloodhound-style collection. Run the Howl collector in your Discord browser console, and the graph renders automatically.

## Usage

```sh
bun install
bun run dev
```

1. Open http://localhost:5173
2. Click "Run Howl collector" in the sidebar
3. Copy the script, paste it into Discord's browser console (F12)
4. Graph appears when collection finishes

## Build

```sh
bun run build
```

## Project structure

```
static/
  howl.js               Collector script (runs in Discord console)
src/
  lib/
    ForceGraph.svelte   D3 force graph
    Sidebar.svelte      Stats, search, controls
    SearchBar.svelte    Friend search
    Tooltip.svelte      Hover details
    FetchPanel.svelte   Collector modal and listener
    discord-fetch.ts    Data processing
    graph-utils.ts      Edges, hulls, colors
    theme.svelte.ts     Dark/light mode
    types.ts            TypeScript types
  routes/
    +page.svelte        Main page
    api/ingest/         Collector endpoint
```
