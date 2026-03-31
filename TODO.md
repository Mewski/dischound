# Discord Friend Graph — Svelte App

## Data
- Source: `discord_friend_graph.json` (140 friends, mutual friends + mutual servers)
- Avatar API: `https://discordpfp.vercel.app/api/json?id={USER_ID}` returns `{ success: true, avatar: "https://cdn.discordapp.com/..." }`
- Avatar redirect: `https://discordpfp.vercel.app/api/avatar?id={USER_ID}` (redirects to image)

## Step 1: Cache avatars locally
- Write a Python/Node script that reads `discord_friend_graph.json`
- For each unique user ID (friends + their mutuals), fetch avatar URL from the JSON endpoint
- Download the actual image to `static/avatars/{user_id}.png`
- Rate limit: ~1 req/sec to be polite to the API
- Output an enriched `graph_data.json` with avatar paths included

## Step 2: Scaffold Svelte app
- `npm create svelte@latest discord-graph` (skeleton, TypeScript)
- Install deps: `d3`, `d3-polygon` (for convex hulls)
- Copy `graph_data.json` and cached avatars into `static/`

## Step 3: Pre-process graph data
- Build adjacency list from mutual_friends
- Run community detection (Louvain or greedy modularity) — either:
  - Pre-compute in Python with networkx, save cluster assignments in `graph_data.json`
  - Or implement a simple modularity algorithm in JS
- Pre-computing in Python is easier — add `cluster` field to each node in the JSON
- Compute betweenness centrality per node, add as `bridging_score` field
- Final `graph_data.json` shape per node:
  ```json
  {
    "id": "123",
    "name": "username",
    "display_name": "Username",
    "avatar": "/avatars/123.png",
    "cluster": 0,
    "bridging_score": 0.35,
    "mutual_friends": ["id1", "id2"],
    "mutual_servers": [{"id": "...", "nick": null}]
  }
  ```

## Step 4: D3 force-directed graph in Svelte
- Create `ForceGraph.svelte` component
- D3 force simulation with:
  - `forceLink` on mutual friend edges
  - `forceManyBody` (repulsion)
  - `forceCenter`
  - `forceCollide` (prevent node overlap, radius based on node size)
- Render on `<canvas>` for performance (140 nodes is fine on SVG too, but canvas is smoother)
  - Actually SVG is better here for interactivity + image embedding — 140 nodes is trivial
- Nodes: circular `<clipPath>` + `<image>` for profile pictures
- Node size: scaled by `bridging_score` (bigger = more risk)
- Edge: thin semi-transparent lines between mutual friends

## Step 5: Convex hulls around clusters
- For each cluster, compute `d3.polygonHull()` from node positions
- Draw filled semi-transparent polygon behind each cluster
- Update hull positions on each simulation tick
- Add padding to hulls (offset the polygon outward by ~20px) so they wrap nicely
- Use catmull-rom or basis curve interpolation for smooth hull shapes
- Color each cluster distinctly (use a nice palette, not rainbow vomit)

## Step 6: Interactivity
- **Zoom/Pan**: `d3.zoom()` on the SVG
- **Drag**: `d3.drag()` on nodes, reheat simulation on drag
- **Hover tooltip**: on node hover, show a card with:
  - Large avatar
  - Username / display name
  - Cluster name/number
  - Bridging score (with plain English: "High risk" / "Low risk")
  - Number of mutual friends
  - Number of shared servers
  - List of mutual friend names
- **Click**: click a node to highlight it + all its connections, dim everything else
- **Search bar**: filter/highlight nodes by name, auto-scroll to them
- **Cluster toggle**: sidebar with cluster list, click to show/hide clusters

## Step 7: Opsec sidebar panel
- Summary stats: total friends, total connections, clusters, isolated nodes
- "Top bridging risks" ranked list with avatars
- "Isolated friends" list (no mutuals)
- "Largest shared servers" list with member counts
- Clicking any item in the sidebar highlights it on the graph

## Step 8: Styling
- Dark theme (#0d1117 background, similar to Discord)
- Smooth transitions and animations
- Responsive layout (graph takes ~75%, sidebar ~25%)
- Nice typography (Inter or similar)
- Subtle glow on hover
- Edge bundling or curve if it looks cleaner

## Tech Stack
- SvelteKit (static adapter for export)
- D3.js (force layout, hulls, zoom)
- TypeScript
- Tailwind CSS (optional, or just plain CSS)
- Python (networkx) for pre-processing

## Directory Structure
```
discord-graph/
  static/
    avatars/          # cached PFPs
    graph_data.json   # enriched graph data
  src/
    lib/
      ForceGraph.svelte
      Sidebar.svelte
      Tooltip.svelte
      SearchBar.svelte
      types.ts
      graph-utils.ts  # hull computation, highlighting logic
    routes/
      +page.svelte    # main layout
  scripts/
    cache_avatars.py  # step 1: download avatars
    preprocess.py     # step 3: community detection + metrics
```
