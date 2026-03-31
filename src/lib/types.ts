export interface GraphNode {
	id: string;
	username: string;
	display_name: string;
	avatar: string | null;
	cluster: number;
	bridging_score: number;
	mutuals: string[];
	guilds: { id: string; nick: string | null }[];
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
	index?: number;
}

export interface GraphEdge {
	source: string | GraphNode;
	target: string | GraphNode;
}

export interface ServerInfo {
	name: string;
	icon: string | null;
}

export interface GraphData {
	nodes: GraphNode[];
	servers: Record<string, ServerInfo>;
	stats: {
		total_friends: number;
		total_connections: number;
		clusters: number;
		isolated_count: number;
	};
}
