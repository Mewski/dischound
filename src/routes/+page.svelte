<script lang="ts">
	import { onMount } from 'svelte';
	import ForceGraph from '$lib/ForceGraph.svelte';
	import Tooltip from '$lib/Tooltip.svelte';
	import Sidebar from '$lib/Sidebar.svelte';
	import { assignMutualClusters, assignServerClusters } from '$lib/discord-fetch';
	import type { GraphNode, GraphData } from '$lib/types';

	const CACHE_KEY = 'dischound_data';
	const CACHE_VERSION = 3;
	const CACHE_TTL = 1000 * 60 * 60;

	let rawData: GraphData | null = $state(null);
	let data: GraphData | null = $state(null);
	let viewMode: 'mutuals' | 'servers' = $state('mutuals');
	let selectedNode: GraphNode | null = $state(null);
	let hoveredNode: GraphNode | null = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let searchHighlight: Set<string> = $state(new Set());
	let hiddenClusters: Set<number> = $state(new Set());

	function loadCache(): GraphData | null {
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			const cached = JSON.parse(raw);
			if (cached.v !== CACHE_VERSION || Date.now() - cached.ts > CACHE_TTL) return null;
			return cached.data;
		} catch {
			return null;
		}
	}

	function saveCache(d: GraphData) {
		try {
			localStorage.setItem(
				CACHE_KEY,
				JSON.stringify({ v: CACHE_VERSION, ts: Date.now(), data: d }),
			);
		} catch {
			/* localStorage may be full or unavailable */
		}
	}

	function applyMode(source: GraphData, mode: 'mutuals' | 'servers'): GraphData {
		const clone = structuredClone(source);
		if (mode === 'servers') {
			assignServerClusters(clone.nodes);
		} else {
			assignMutualClusters(clone.nodes);
		}
		const clusterSet = new Set(clone.nodes.map((n) => n.cluster).filter((c) => c >= 0));
		clone.stats.clusters = clusterSet.size;
		return clone;
	}

	function setData(d: GraphData) {
		rawData = d;
		data = applyMode(d, viewMode);
		saveCache(d);
	}

	onMount(() => {
		const cached = loadCache();
		if (cached) setData(cached);
	});

	function handleViewModeChange(mode: 'mutuals' | 'servers') {
		if (!rawData) return;
		viewMode = mode;
		hiddenClusters = new Set();
		data = applyMode(rawData, mode);
	}

	function handleFetch(fetched: GraphData) {
		setData(fetched);
	}

	function handleNodeHover(node: GraphNode | null, event: MouseEvent | null) {
		hoveredNode = node;
		if (event) {
			tooltipX = event.clientX;
			tooltipY = event.clientY;
		}
	}

	function handleToggleCluster(cluster: number) {
		const next = new Set(hiddenClusters);
		if (next.has(cluster)) next.delete(cluster);
		else next.add(cluster);
		hiddenClusters = next;
	}
</script>

<div class="flex h-screen w-screen">
	<Sidebar
		{data}
		{viewMode}
		onNodeClick={(node) => (selectedNode = node)}
		onSearch={(ids) => (searchHighlight = ids)}
		onFetch={handleFetch}
		onViewModeChange={handleViewModeChange}
		{hiddenClusters}
		onToggleCluster={handleToggleCluster}
	/>
	<div class="flex-1 relative overflow-hidden">
		{#if data}
			<ForceGraph
				nodes={data.nodes}
				onNodeHover={handleNodeHover}
				onNodeClick={(node) => (selectedNode = node)}
				{selectedNode}
				{searchHighlight}
				{hiddenClusters}
			/>
			<Tooltip node={hoveredNode} x={tooltipX} y={tooltipY} />
		{:else}
			<div
				class="flex items-center justify-center w-full h-full text-[var(--color-text-dim)] font-sans text-sm"
			>
				Run Howl to load data
			</div>
		{/if}
	</div>
</div>
