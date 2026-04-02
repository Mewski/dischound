import { polygonHull } from 'd3';
import type { GraphNode, GraphEdge } from './types';

export function buildEdges(nodes: GraphNode[]): GraphEdge[] {
	const nodeIds = new Set(nodes.map((n) => n.id));
	const seen = new Set<string>();
	const edges: GraphEdge[] = [];

	for (const node of nodes) {
		for (const friendId of node.mutuals) {
			if (!nodeIds.has(friendId)) continue;
			const key = [node.id, friendId].sort().join('-');
			if (seen.has(key)) continue;
			seen.add(key);
			edges.push({ source: node.id, target: friendId });
		}
	}
	return edges;
}

const CLUSTER_COLORS = [
	'#e74c3c',
	'#3498db',
	'#2ecc71',
	'#f39c12',
	'#9b59b6',
	'#1abc9c',
	'#e67e22',
	'#e91e63',
	'#00bcd4',
	'#8bc34a',
	'#ff5722',
	'#607d8b',
	'#795548',
	'#cddc39',
	'#ffeb3b',
	'#26a69a',
	'#ab47bc',
	'#ef5350',
];

export function clusterColor(cluster: number): string {
	if (cluster < 0) return '#666666';
	return CLUSTER_COLORS[cluster % CLUSTER_COLORS.length];
}

function nodeHullPoints(
	n: GraphNode,
	nodeRadius: (n: GraphNode) => number,
	padding: number,
): [number, number][] {
	const r = nodeRadius(n) + padding;
	const textBottom = nodeRadius(n) + 22 + padding;
	const textHalfWidth = Math.max(r, n.username.length * 2.7 + padding);
	const points: [number, number][] = [];
	for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
		const py = n.y! + Math.sin(a) * r;
		const extendedY = Math.max(py, n.y! + textBottom);
		points.push([n.x! + Math.cos(a) * r, a > 0 && a < Math.PI ? extendedY : py]);
	}
	points.push([n.x! - textHalfWidth, n.y! + textBottom]);
	points.push([n.x! + textHalfWidth, n.y! + textBottom]);
	return points;
}

export function computeHulls(
	nodes: GraphNode[],
	nodeRadius: (n: GraphNode) => number,
	padding = 10,
	hiddenClusters: Set<number> = new Set(),
): Map<number, [number, number][]> {
	const hulls = new Map<number, [number, number][]>();
	const byCluster = new Map<number, GraphNode[]>();

	for (const node of nodes) {
		if (node.cluster < 0 || node.x == null || node.y == null) continue;
		if (hiddenClusters.has(node.cluster)) continue;
		if (!byCluster.has(node.cluster)) byCluster.set(node.cluster, []);
		byCluster.get(node.cluster)!.push(node);
	}

	for (const [cluster, clusterNodes] of byCluster) {
		const points: [number, number][] = [];
		for (const n of clusterNodes) {
			points.push(...nodeHullPoints(n, nodeRadius, padding));
		}

		const hull = polygonHull(points);
		if (hull) hulls.set(cluster, hull);
	}

	return hulls;
}

export function computeServerHulls(
	nodes: GraphNode[],
	nodeRadius: (n: GraphNode) => number,
	padding = 10,
	hiddenClusters: Set<number> = new Set(),
): Map<number, [number, number][]> {
	// Map cluster index to server ID (same ordering as assignServerClusters)
	const serverPop = new Map<string, number>();
	for (const node of nodes) {
		for (const g of node.guilds) {
			serverPop.set(g.id, (serverPop.get(g.id) ?? 0) + 1);
		}
	}
	const clusterToServer = new Map<number, string>();
	[...serverPop.entries()]
		.sort((a, b) => b[1] - a[1])
		.forEach(([id], i) => clusterToServer.set(i, id));

	// Visible clusters and their server IDs
	const visibleClusters = new Set<number>();
	for (const node of nodes) {
		if (node.cluster >= 0 && !hiddenClusters.has(node.cluster)) {
			visibleClusters.add(node.cluster);
		}
	}

	// Index visible nodes by server membership for fast lookup
	const nodesByServer = new Map<string, GraphNode[]>();
	for (const node of nodes) {
		if (node.x == null || node.y == null || hiddenClusters.has(node.cluster)) continue;
		for (const g of node.guilds) {
			if (!nodesByServer.has(g.id)) nodesByServer.set(g.id, []);
			nodesByServer.get(g.id)!.push(node);
		}
	}

	// Build hull for each visible cluster using all visible nodes sharing that server
	const hulls = new Map<number, [number, number][]>();
	for (const cluster of visibleClusters) {
		const serverId = clusterToServer.get(cluster);
		if (!serverId) continue;
		const members = nodesByServer.get(serverId);
		if (!members || members.length === 0) continue;

		const points: [number, number][] = [];
		for (const n of members) {
			points.push(...nodeHullPoints(n, nodeRadius, padding));
		}

		const hull = polygonHull(points);
		if (hull) hulls.set(cluster, hull);
	}

	return hulls;
}

export function bridgingLabel(score: number): string {
	if (score >= 0.15) return 'High';
	if (score >= 0.05) return 'Medium';
	if (score > 0) return 'Low';
	return 'None';
}

export function bridgingColor(score: number): string {
	if (score >= 0.15) return '#e74c3c';
	if (score >= 0.05) return '#f39c12';
	if (score > 0) return '#2ecc71';
	return '#666666';
}
