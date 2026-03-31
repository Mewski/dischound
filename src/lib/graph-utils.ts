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

export function computeHulls(nodes: GraphNode[], padding = 30, minSize = 3): Map<number, [number, number][]> {
	const hulls = new Map<number, [number, number][]>();
	const byCluster = new Map<number, GraphNode[]>();

	for (const node of nodes) {
		if (node.cluster < 0 || node.x == null || node.y == null) continue;
		if (!byCluster.has(node.cluster)) byCluster.set(node.cluster, []);
		byCluster.get(node.cluster)!.push(node);
	}

	for (const [cluster, clusterNodes] of byCluster) {
		if (clusterNodes.length < minSize) continue;

		const points: [number, number][] = clusterNodes.map((n) => [n.x!, n.y!]);
		const hull = d3.polygonHull(points);
		if (!hull) continue;

		const centroid = d3.polygonCentroid(hull);
		const padded: [number, number][] = hull.map(([x, y]) => {
			const dx = x - centroid[0];
			const dy = y - centroid[1];
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len === 0) return [x, y] as [number, number];
			return [x + (dx / len) * padding, y + (dy / len) * padding] as [number, number];
		});

		hulls.set(cluster, padded);
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
