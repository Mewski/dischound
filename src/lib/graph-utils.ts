import * as d3 from 'd3';
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
	const points: [number, number][] = [];
	for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
		const py = n.y! + Math.sin(a) * r;
		const extendedY = Math.max(py, n.y! + textBottom);
		points.push([n.x! + Math.cos(a) * r, a > 0 && a < Math.PI ? extendedY : py]);
	}
	points.push([n.x! - r, n.y! + textBottom]);
	points.push([n.x! + r, n.y! + textBottom]);
	return points;
}

export function computeHulls(
	nodes: GraphNode[],
	nodeRadius: (n: GraphNode) => number,
	padding = 10,
): Map<number, [number, number][]> {
	const hulls = new Map<number, [number, number][]>();
	const byCluster = new Map<number, GraphNode[]>();

	for (const node of nodes) {
		if (node.cluster < 0 || node.x == null || node.y == null) continue;
		if (!byCluster.has(node.cluster)) byCluster.set(node.cluster, []);
		byCluster.get(node.cluster)!.push(node);
	}

	for (const [cluster, clusterNodes] of byCluster) {
		if (clusterNodes.length < 3) continue;

		const points: [number, number][] = [];
		for (const n of clusterNodes) {
			points.push(...nodeHullPoints(n, nodeRadius, padding));
		}

		const hull = d3.polygonHull(points);
		if (hull) hulls.set(cluster, hull);
	}

	return hulls;
}

export function computeServerHulls(
	nodes: GraphNode[],
	nodeRadius: (n: GraphNode) => number,
	padding = 10,
): Map<number, [number, number][]> {
	const serverMembers = new Map<string, GraphNode[]>();

	for (const node of nodes) {
		if (node.x == null || node.y == null) continue;
		for (const g of node.guilds) {
			if (!serverMembers.has(g.id)) serverMembers.set(g.id, []);
			serverMembers.get(g.id)!.push(node);
		}
	}

	const sorted = [...serverMembers.entries()].sort((a, b) => b[1].length - a[1].length);

	const hulls = new Map<number, [number, number][]>();
	for (let i = 0; i < sorted.length; i++) {
		const members = sorted[i][1];
		if (members.length < 3) continue;

		const points: [number, number][] = [];
		for (const n of members) {
			points.push(...nodeHullPoints(n, nodeRadius, padding));
		}

		const hull = d3.polygonHull(points);
		if (hull) hulls.set(i, hull);
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
