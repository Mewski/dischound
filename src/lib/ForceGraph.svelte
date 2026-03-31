<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { GraphNode, GraphEdge } from './types';
	import { buildEdges, clusterColor, computeHulls, computeServerHulls } from './graph-utils';

	let {
		nodes,
		viewMode = 'mutuals',
		onNodeHover = () => {},
		onNodeClick = () => {},
		selectedNode = null,
		searchHighlight = new Set<string>(),
		hiddenClusters = new Set<number>(),
	}: {
		nodes: GraphNode[];
		viewMode?: 'mutuals' | 'servers';
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

	const nodeRadius = (n: GraphNode) => (viewMode === 'mutuals' ? 12 + n.bridging_score * 10 : 12);

	function isVisible(n: GraphNode): boolean {
		return !hiddenClusters.has(n.cluster);
	}

	function isEdgeHighlighted(e: GraphEdge): boolean {
		if (!selectedNode) return true;
		const s = e.source as GraphNode;
		const t = e.target as GraphNode;
		return s.id === selectedNode.id || t.id === selectedNode.id;
	}

	let selectedMutuals = $derived(selectedNode ? new Set(selectedNode.mutuals) : new Set<string>());

	function isHighlighted(n: GraphNode): boolean {
		if (searchHighlight.size > 0) return searchHighlight.has(n.id);
		if (!selectedNode) return true;
		if (n.id === selectedNode.id) return true;
		return selectedMutuals.has(n.id);
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

		const pull = viewMode === 'servers' ? 0.15 : 0.04;
		for (const n of nodes) {
			if (n.cluster < 0 || n.x == null || n.y == null) continue;
			const c = centroids.get(n.cluster);
			if (!c) continue;
			n.vx! += (c.x - n.x) * alpha * pull;
			n.vy! += (c.y - n.y) * alpha * pull;
		}

		for (const n of nodes) {
			if (n.cluster < 0 || n.x == null || n.y == null) continue;
			for (const [cluster, c] of centroids) {
				if (cluster === n.cluster) continue;
				const dx = n.x! - c.x;
				const dy = n.y! - c.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const push = (c.count * alpha * 3) / dist;
				n.vx! += (dx / dist) * push;
				n.vy! += (dy / dist) * push;
			}
		}
	}

	function recomputeHulls() {
		hulls =
			viewMode === 'servers'
				? computeServerHulls(nodes, nodeRadius, 10, hiddenClusters)
				: computeHulls(nodes, nodeRadius, 10, hiddenClusters);
	}

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		hiddenClusters.size;
		recomputeHulls();
	});

	const hullLine = d3
		.line<[number, number]>()
		.x((d) => d[0])
		.y((d) => d[1])
		.curve(d3.curveCatmullRomClosed.alpha(0.5));

	let simulation: d3.Simulation<GraphNode, d3.SimulationLinkDatum<GraphNode>>;

	function rebuildSimulation() {
		edges = buildEdges(nodes);

		if (simulation) simulation.stop();

		simulation = d3.forceSimulation<GraphNode>(nodes);

		if (viewMode === 'mutuals') {
			const nodeMap = new Map(nodes.map((n) => [n.id, n]));
			simulation.force(
				'link',
				d3
					.forceLink<GraphNode, GraphEdge>(edges)
					.id((d) => d.id)
					.distance((e) => {
						const s = typeof e.source === 'string' ? nodeMap.get(e.source) : e.source;
						const t = typeof e.target === 'string' ? nodeMap.get(e.target) : e.target;
						return s?.cluster !== t?.cluster ? 200 : 90;
					})
					.strength((e) => {
						const s = typeof e.source === 'string' ? nodeMap.get(e.source) : e.source;
						const t = typeof e.target === 'string' ? nodeMap.get(e.target) : e.target;
						return s?.cluster !== t?.cluster ? 0.02 : 0.3;
					}),
			);
		}

		let frameId = 0;
		simulation
			.force('charge', d3.forceManyBody().strength(-200).distanceMax(400))
			.force('x', d3.forceX(0).strength(0.02))
			.force('y', d3.forceY(0).strength(0.02))
			.force(
				'collide',
				d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 14),
			)
			.force('cluster', clusterForce)
			.on('tick', () => {
				if (!frameId) {
					frameId = requestAnimationFrame(() => {
						recomputeHulls();
						ticked++;
						frameId = 0;
					});
				}
			});
	}

	function centerTransform(): d3.ZoomTransform {
		const { width, height } = svgEl!.getBoundingClientRect();
		return d3.zoomIdentity.translate(width / 2, height / 2);
	}

	onMount(() => {
		rebuildSimulation();

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 8])
			.on('zoom', (event) => {
				transform = event.transform;
				try {
					sessionStorage.setItem(
						'dischound_transform',
						JSON.stringify({ x: transform.x, y: transform.y, k: transform.k }),
					);
				} catch {}
			});

		const svg = d3.select(svgEl!);
		svg.call(zoom);

		let initialTransform: d3.ZoomTransform;
		try {
			const saved = sessionStorage.getItem('dischound_transform');
			if (saved) {
				const { x, y, k } = JSON.parse(saved);
				initialTransform = d3.zoomIdentity.translate(x, y).scale(k);
			} else {
				initialTransform = centerTransform();
			}
		} catch {
			initialTransform = centerTransform();
		}
		svg.call(zoom.transform, initialTransform);

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

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));
		const applyDrag = () => {
			d3.select(svgEl!)
				.selectAll<SVGGElement, GraphNode>('.node-group')
				.each(function () {
					const node = nodeMap.get(this.dataset.id!);
					if (node) d3.select(this).datum(node);
				})
				.call(drag);
		};

		requestAnimationFrame(applyDrag);
		const observer = new MutationObserver(applyDrag);
		observer.observe(svgEl!, { childList: true, subtree: true });

		const handleVisibility = () => {
			if (document.hidden) simulation.stop();
			else simulation.restart();
		};
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', handleVisibility);
			simulation.stop();
		};
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

		{#if viewMode === 'mutuals'}
			<!-- eslint-disable-next-line svelte/require-each-key -->
			{#each edges as edge}
				{@const source = edge.source as GraphNode}
				{@const target = edge.target as GraphNode}
				{#if isVisible(source) && isVisible(target)}
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
		{/if}

		{#each nodes as node (node.id)}
			{#if isVisible(node)}
				{@const r = nodeRadius(node)}
				{@const highlighted = isHighlighted(node)}
				<g
					class="node-group"
					data-id={node.id}
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
							crossorigin="anonymous"
							x={-r}
							y={-r}
							width={r * 2}
							height={r * 2}
							clip-path="url(#clip-{node.id})"
							preserveAspectRatio="xMidYMid slice"
							onerror={(e) => {
								(e.currentTarget as SVGImageElement).style.display = 'none';
							}}
						/>
					{:else}
						<text
							text-anchor="middle"
							dominant-baseline="central"
							style="fill: white"
							font-size={r * 0.9}
							font-family="Inter, sans-serif"
							font-weight="600">{(node.username || '?')[0].toUpperCase()}</text
						>
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
	<!-- Force re-render: d3 mutates node positions in place, bypassing Svelte reactivity -->
	{#key ticked}{/key}
</svg>
