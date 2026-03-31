<script lang="ts">
	import { onMount } from 'svelte';
	import ForceGraph from '$lib/ForceGraph.svelte';
	import Tooltip from '$lib/Tooltip.svelte';
	import Sidebar from '$lib/Sidebar.svelte';
	import {
		assignMutualClusters,
		assignServerClusters,
		computeBridgingScores,
	} from '$lib/data-processing';
	import type { GraphNode, GraphData } from '$lib/types';

	const CACHE_KEY = 'dischound_data';
	const CACHE_VERSION = 3;
	const CACHE_TTL = 1000 * 60 * 60 * 24;

	let data: GraphData | null = $state(null);
	let graphKey = $state(0);
	let cachedMutuals: GraphData | null = null;
	let cachedServers: GraphData | null = null;
	let viewMode: 'mutuals' | 'servers' = $state(
		(typeof localStorage !== 'undefined' && localStorage.getItem('dischound_view')) === 'servers'
			? 'servers'
			: 'mutuals',
	);
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
		} catch {}
	}

	function buildView(d: GraphData, mode: 'mutuals' | 'servers'): GraphData {
		const v: GraphData = structuredClone(d);
		if (mode === 'servers') {
			assignServerClusters(v.nodes);
		} else {
			assignMutualClusters(v.nodes);
		}
		computeBridgingScores(v.nodes);
		v.stats.clusters = new Set(v.nodes.map((n) => n.cluster).filter((c) => c >= 0)).size;
		return v;
	}

	function setData(d: GraphData) {
		cachedMutuals = buildView(d, 'mutuals');
		cachedServers = buildView(d, 'servers');
		data = viewMode === 'mutuals' ? cachedMutuals : cachedServers;
		graphKey++;
		saveCache(d);
	}

	onMount(() => {
		const cached = loadCache();
		if (cached) setData(cached);
	});

	function handleViewModeChange(mode: 'mutuals' | 'servers') {
		if (mode === viewMode) return;
		viewMode = mode;
		hiddenClusters = new Set();
		selectedNode = null;
		data = mode === 'mutuals' ? cachedMutuals : cachedServers;
		graphKey++;
		localStorage.setItem('dischound_view', mode);
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

	function getClusterLabel(node: GraphNode | null): string {
		if (!node || !data) return '';
		if (viewMode === 'mutuals') return node.cluster < 0 ? 'Unclustered' : `Cluster ${node.cluster}`;
		if (node.cluster < 0) return 'No Server';
		// Find most common server in this cluster's members
		const members = data.nodes.filter((n) => n.cluster === node.cluster);
		const freq = new Map<string, number>();
		for (const n of members) {
			for (const g of n.guilds) {
				freq.set(g.id, (freq.get(g.id) ?? 0) + 1);
			}
		}
		let bestId = '';
		let bestCount = 0;
		for (const [id, count] of freq) {
			if (count > bestCount) {
				bestId = id;
				bestCount = count;
			}
		}
		return data.servers[bestId]?.name ?? `Server ${node.cluster}`;
	}

	function handleToggleCluster(cluster: number) {
		const next = new Set(hiddenClusters);
		if (next.has(cluster)) next.delete(cluster);
		else next.add(cluster);
		hiddenClusters = next;
	}
</script>

<div class="flex h-dvh w-screen">
	<Sidebar
		{data}
		{viewMode}
		{selectedNode}
		onNodeClick={(node) => (selectedNode = selectedNode?.id === node.id ? null : node)}
		onSearch={(ids) => (searchHighlight = ids)}
		onFetch={handleFetch}
		onViewModeChange={handleViewModeChange}
		{hiddenClusters}
		onToggleCluster={handleToggleCluster}
	/>
	<div class="flex-1 relative overflow-hidden">
		{#if data}
			{#key graphKey}
				<ForceGraph
					nodes={data.nodes}
					{viewMode}
					onNodeHover={handleNodeHover}
					onNodeClick={(node) => (selectedNode = node)}
					{selectedNode}
					{searchHighlight}
					{hiddenClusters}
				/>
			{/key}
			<Tooltip
				node={hoveredNode}
				x={tooltipX}
				y={tooltipY}
				{viewMode}
				clusterLabel={getClusterLabel(hoveredNode)}
			/>
		{:else}
			<div
				class="flex items-center justify-center w-full h-full text-[var(--color-text-dim)] font-sans text-sm"
			>
				Run Howl to load data
			</div>
		{/if}
	</div>
</div>
