<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { GraphNode, GraphEdge } from './types';
	import { buildEdges, clusterColor, computeHulls } from './graph-utils';

	let {
		nodes,
		minClusterSize = 3,
		onNodeHover = () => {},
		onNodeClick = () => {},
		selectedNode = null,
		searchHighlight = new Set<string>(),
		hiddenClusters = new Set<number>(),
	}: {
		nodes: GraphNode[];
		minClusterSize?: number;
		onNodeHover?: (node: GraphNode | null, event: MouseEvent | null) => void;
		onNodeClick?: (node: GraphNode | null) => void;
		selectedNode?: GraphNode | null;
		searchHighlight?: Set<string>;
		hiddenClusters?: Set<number>;
	} = $props();

	let svgEl: SVGSVGElement | undefined = $state();
	let edges: GraphEdge[] = $state([]);
	let hulls: Map<number, [number, number][]> = $state(new Map());
	let transform = $state(d3.zoomIdentity);
	let ticked = $state(0);
	let lastNodeCount = 0;

	const nodeRadius = (n: GraphNode) => 8 + n.bridging_score * 80;

	function isVisible(n: GraphNode): boolean {
		return !hiddenClusters.has(n.cluster);
	}

	function isEdgeHighlighted(e: GraphEdge): boolean {
		if (!selectedNode) return true;
		const sid = typeof e.source === 'string' ? e.source : e.source.id;
		const tid = typeof e.target === 'string' ? e.target : e.target.id;
		return sid === selectedNode.id || tid === selectedNode.id;
	}

	function isHighlighted(n: GraphNode): boolean {
		if (searchHighlight.size > 0) return searchHighlight.has(n.id);
		if (!selectedNode) return true;
		if (n.id === selectedNode.id) return true;
		return selectedNode.mutuals.includes(n.id);
	}

	function clusterForce(alpha: number) {
		const centroids = new Map<number, { x: number; y: number; count: number }>();
		for (const n of nodes) {
			if (n.cluster < 0 || n.x == null || n.y == null) continue;
			const c = centroids.get(n.cluster) ?? { x: 0, y: 0, count: 0 };
			c.x += n.x;
			c.y += n.y;
			c.count++;
			centroids.set(n.cluster, c);
		}
		for (const c of centroids.values()) {
			c.x /= c.count;
			c.y /= c.count;
		}
		for (const n of nodes) {
			if (n.cluster < 0 || n.x == null || n.y == null) continue;
			const c = centroids.get(n.cluster);
			if (!c) continue;
			n.vx! += (c.x - n.x) * alpha * 0.3;
			n.vy! += (c.y - n.y) * alpha * 0.3;
		}
	}

	const hullLine = d3
		.line<[number, number]>()
		.x((d) => d[0])
		.y((d) => d[1])
		.curve(d3.curveCatmullRomClosed.alpha(0.5));

	let simulation: d3.Simulation<GraphNode, d3.SimulationLinkDatum<GraphNode>>;

	function rebuildSimulation() {
		edges = buildEdges(nodes);

		if (simulation) simulation.stop();

		simulation = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphEdge>(edges)
					.id((d) => d.id)
					.distance(100)
					.strength(0.3),
			)
			.force('charge', d3.forceManyBody().strength(-200))
			.force('center', d3.forceCenter(0, 0))
			.force(
				'collide',
				d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 6),
			)
			.force('cluster', clusterForce)
			.on('tick', () => {
				hulls = computeHulls(nodes, 30, minClusterSize);
				ticked++;
			});

		lastNodeCount = nodes.length;
	}

	onMount(() => {
		rebuildSimulation();

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 8])
			.on('zoom', (event) => {
				transform = event.transform;
			});

		d3.select(svgEl!).call(zoom);

		const drag = d3
			.drag<SVGGElement, GraphNode>()
			.on('start', (event, d) => {
				if (!event.active) simulation.alphaTarget(0.3).restart();
				d.fx = d.x;
				d.fy = d.y;
			})
			.on('drag', (event, d) => {
				d.fx = event.x;
				d.fy = event.y;
			})
			.on('end', (event, d) => {
				if (!event.active) simulation.alphaTarget(0);
				d.fx = null;
				d.fy = null;
			});

		const applyDrag = () => {
			d3.select(svgEl!).selectAll<SVGGElement, GraphNode>('.node-group').data(nodes).call(drag);
		};

		requestAnimationFrame(applyDrag);
		const observer = new MutationObserver(applyDrag);
		observer.observe(svgEl!, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			simulation.stop();
		};
	});

	$effect(() => {
		if (nodes.length !== lastNodeCount && nodes.length > 0) {
			rebuildSimulation();
		}
	});

	function handleSvgClick(event: MouseEvent) {
		if ((event.target as Element).closest('.node-group')) return;
		onNodeClick(null);
	}
</script>

<svg
	bind:this={svgEl}
	class="w-full h-full"
	style="background: var(--color-bg)"
	role="application"
	onclick={handleSvgClick}
>
	<g transform="translate({transform.x},{transform.y}) scale({transform.k})">
		{#each [...hulls.entries()] as [cluster, points] (cluster)}
			{#if !hiddenClusters.has(cluster)}
				<path
					d={hullLine(points) ?? ''}
					fill={clusterColor(cluster)}
					fill-opacity="0.08"
					stroke={clusterColor(cluster)}
					stroke-opacity="0.2"
					stroke-width="1"
				/>
			{/if}
		{/each}

		<!-- eslint-disable-next-line svelte/require-each-key -->
		{#each edges as edge}
			{@const source =
				typeof edge.source === 'string' ? nodes.find((n) => n.id === edge.source) : edge.source}
			{@const target =
				typeof edge.target === 'string' ? nodes.find((n) => n.id === edge.target) : edge.target}
			{#if source && target && isVisible(source) && isVisible(target)}
				<line
					x1={source.x}
					y1={source.y}
					x2={target.x}
					y2={target.y}
					style="stroke: var(--color-text-dim)"
					stroke-opacity={isEdgeHighlighted(edge) ? 0.5 : 0.12}
					stroke-width="0.8"
				/>
			{/if}
		{/each}

		{#each nodes as node (node.id)}
			{#if isVisible(node)}
				{@const r = nodeRadius(node)}
				{@const highlighted = isHighlighted(node)}
				<g
					class="node-group"
					transform="translate({node.x ?? 0},{node.y ?? 0})"
					opacity={highlighted ? 1 : 0.15}
					onmouseenter={(e: MouseEvent) => onNodeHover(node, e)}
					onmouseleave={() => onNodeHover(null, null)}
					onclick={(e: MouseEvent) => {
						e.stopPropagation();
						onNodeClick(selectedNode?.id === node.id ? null : node);
					}}
					style="cursor: pointer;"
				>
					{#if selectedNode?.id === node.id || searchHighlight.has(node.id)}
						<circle
							r={r + 4}
							fill="none"
							stroke={clusterColor(node.cluster)}
							stroke-width="2"
							stroke-opacity="0.8"
						/>
					{/if}

					<clipPath id="clip-{node.id}">
						<circle {r} />
					</clipPath>

					<circle
						{r}
						fill={clusterColor(node.cluster)}
						stroke={clusterColor(node.cluster)}
						stroke-width="1.5"
						stroke-opacity="0.6"
					/>

					{#if node.avatar}
						<image
							href={node.avatar}
							x={-r}
							y={-r}
							width={r * 2}
							height={r * 2}
							clip-path="url(#clip-{node.id})"
							preserveAspectRatio="xMidYMid slice"
						/>
					{/if}

					<text
						y={r + 12}
						text-anchor="middle"
						style="fill: var(--color-text)"
						font-size="9"
						font-family="Inter, sans-serif"
						opacity="0.7">{node.username}</text
					>
				</g>
			{/if}
		{/each}
	</g>
	{#key ticked}{/key}
</svg>
