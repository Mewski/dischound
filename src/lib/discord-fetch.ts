import type { GraphData, GraphNode } from './types';

interface RawPayload {
	nodes: {
		id: string;
		username: string;
		display_name?: string;
		avatar: string | null;
		mutuals: string[];
		guilds: { id: string; nick: string | null }[];
	}[];
	servers: Record<string, { name: string; icon: string | null }>;
}

export function processRawData(raw: RawPayload): GraphData {
	const nodeIds = new Set(raw.nodes.map((n) => n.id));

	const nodes: GraphNode[] = raw.nodes.map((n) => ({
		id: n.id,
		username: n.username,
		display_name: n.display_name ?? n.username,
		avatar: n.avatar,
		cluster: -1,
		bridging_score: 0,
		mutuals: n.mutuals.filter((id) => nodeIds.has(id)),
		guilds: n.guilds,
	}));

	let edgeCount = 0;
	const seen = new Set<string>();
	for (const node of nodes) {
		for (const fid of node.mutuals) {
			const key = [node.id, fid].sort().join('-');
			if (!seen.has(key)) {
				seen.add(key);
				edgeCount++;
			}
		}
	}

	return {
		nodes,
		servers: raw.servers,
		stats: {
			total_friends: nodes.length,
			total_connections: edgeCount,
			clusters: 0,
			isolated_count: nodes.filter((n) => n.mutuals.length === 0).length,
		},
	};
}

export function computeBridgingScores(nodes: GraphNode[]): void {
	const idToNode = new Map(nodes.map((n) => [n.id, n]));
	let max = 0;

	for (const node of nodes) {
		if (node.mutuals.length === 0) continue;
		let crossCluster = 0;
		for (const fid of node.mutuals) {
			const friend = idToNode.get(fid);
			if (friend && friend.cluster !== node.cluster) crossCluster++;
		}
		const score = (crossCluster / node.mutuals.length) * Math.log2(node.mutuals.length + 1);
		node.bridging_score = score;
		if (score > max) max = score;
	}

	if (max > 0) {
		for (const node of nodes) node.bridging_score /= max;
	}
}

export function assignMutualClusters(nodes: GraphNode[]): void {
	const labels = new Map<string, string>();

	for (const n of nodes) labels.set(n.id, n.id);

	for (let iter = 0; iter < 20; iter++) {
		let changed = false;
		const shuffled = [...nodes];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		for (const node of shuffled) {
			if (node.mutuals.length === 0) continue;

			const freq = new Map<string, number>();
			for (const fid of node.mutuals) {
				const label = labels.get(fid);
				if (label) freq.set(label, (freq.get(label) ?? 0) + 1);
			}

			let bestLabel = labels.get(node.id)!;
			let bestCount = 0;
			for (const [label, count] of freq) {
				if (count > bestCount) {
					bestLabel = label;
					bestCount = count;
				}
			}

			if (bestLabel !== labels.get(node.id)) {
				labels.set(node.id, bestLabel);
				changed = true;
			}
		}

		if (!changed) break;
	}

	const labelToCluster = new Map<string, number>();
	const clusterSizes = new Map<string, number>();
	for (const label of labels.values()) {
		clusterSizes.set(label, (clusterSizes.get(label) ?? 0) + 1);
	}
	[...clusterSizes.entries()]
		.sort((a, b) => b[1] - a[1])
		.forEach(([label], i) => labelToCluster.set(label, i));

	for (const node of nodes) {
		const label = labels.get(node.id)!;
		node.cluster = node.mutuals.length === 0 ? -1 : (labelToCluster.get(label) ?? -1);
	}
}

export function assignServerClusters(nodes: GraphNode[]): void {
	const serverPopularity = new Map<string, number>();
	for (const n of nodes) {
		for (const g of n.guilds) {
			serverPopularity.set(g.id, (serverPopularity.get(g.id) ?? 0) + 1);
		}
	}

	const serverToCluster = new Map<string, number>();
	[...serverPopularity.entries()]
		.sort((a, b) => b[1] - a[1])
		.forEach(([id], i) => serverToCluster.set(id, i));

	for (const node of nodes) {
		if (node.guilds.length === 0) {
			node.cluster = -1;
			continue;
		}
		let best = node.guilds[0].id;
		let bestPop = serverPopularity.get(best) ?? 0;
		for (const g of node.guilds) {
			const pop = serverPopularity.get(g.id) ?? 0;
			if (pop > bestPop) {
				best = g.id;
				bestPop = pop;
			}
		}
		node.cluster = serverToCluster.get(best) ?? -1;
	}
}
