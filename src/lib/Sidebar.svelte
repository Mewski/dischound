<script lang="ts">
	import type { GraphNode, GraphData } from './types';
	import { clusterColor, bridgingColor } from './graph-utils';
	import { theme } from './theme.svelte';
	import SearchBar from './SearchBar.svelte';
	import FetchPanel from './FetchPanel.svelte';

	let {
		data,
		viewMode = 'mutuals',
		onNodeClick = () => {},
		onSearch = () => {},
		onFetch = () => {},
		onViewModeChange = () => {},
		hiddenClusters = new Set<number>(),
		onToggleCluster = () => {},
	}: {
		data: GraphData | null;
		viewMode?: 'mutuals' | 'servers';
		onNodeClick?: (node: GraphNode) => void;
		onSearch?: (ids: Set<string>) => void;
		onFetch?: (data: GraphData) => void;
		onViewModeChange?: (mode: 'mutuals' | 'servers') => void;
		hiddenClusters?: Set<number>;
		onToggleCluster?: (cluster: number) => void;
	} = $props();

	let expandedSections: Record<string, boolean> = $state({
		bridges: true,
		clusters: true,
		isolated: false,
		servers: false,
	});

	function toggleSection(key: string) {
		expandedSections[key] = !expandedSections[key];
	}

	let topBridges = $derived(
		data
			? [...data.nodes]
					.sort((a, b) => b.bridging_score - a.bridging_score)
					.filter((n) => n.bridging_score > 0)
					.slice(0, 10)
			: [],
	);

	let isolated = $derived(data ? data.nodes.filter((n) => n.mutuals.length === 0) : []);

	let clusterGroups = $derived(
		(() => {
			if (!data) return [];
			const map = new Map<number, GraphNode[]>();
			for (const n of data.nodes) {
				if (!map.has(n.cluster)) map.set(n.cluster, []);
				map.get(n.cluster)!.push(n);
			}
			return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
		})(),
	);

	let clusterServerName = $derived(
		(() => {
			if (!data) return new Map<number, string>();
			const map = new Map<number, string>();
			for (const [cluster, members] of clusterGroups) {
				if (cluster < 0) continue;
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
				if (bestId && data.servers[bestId]) {
					map.set(cluster, data.servers[bestId].name);
				}
			}
			return map;
		})(),
	);

	let serverCounts = $derived(
		(() => {
			if (!data) return [];
			const counts = new Map<string, number>();
			for (const n of data.nodes) {
				for (const g of n.guilds) {
					counts.set(g.id, (counts.get(g.id) || 0) + 1);
				}
			}
			return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
		})(),
	);
</script>

<aside
	class="w-[280px] shrink-0 h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] font-sans text-[var(--color-text)] flex flex-col"
>
	<div
		class="flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] shrink-0"
	>
		<h1 class="text-base font-semibold">Dischound</h1>
		<button
			class="flex items-center justify-center w-7 h-7 rounded bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] transition-colors"
			onclick={() => theme.toggle()}
			title={theme.current === 'dark' ? 'Light mode' : 'Dark mode'}
		>
			{#if theme.current === 'dark'}
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5" />
					<path
						d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
					/>
				</svg>
			{:else}
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	</div>

	{#if data}
		<div class="px-4 pt-3 pb-2 flex flex-col gap-2 shrink-0 border-b border-[var(--color-border)]">
			<SearchBar nodes={data.nodes} {onSearch} />

			<div
				class="flex rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 gap-0.5"
			>
				<button
					class="flex-1 py-1.5 text-xs font-medium border-none cursor-pointer transition-colors rounded"
					class:bg-[var(--color-surface-raised)]={viewMode === 'mutuals'}
					class:text-[var(--color-text)]={viewMode === 'mutuals'}
					class:bg-transparent={viewMode !== 'mutuals'}
					class:text-[var(--color-text-dim)]={viewMode !== 'mutuals'}
					onclick={() => onViewModeChange('mutuals')}
				>
					Mutuals
				</button>
				<button
					class="flex-1 py-1.5 text-xs font-medium border-none cursor-pointer transition-colors rounded"
					class:bg-[var(--color-surface-raised)]={viewMode === 'servers'}
					class:text-[var(--color-text)]={viewMode === 'servers'}
					class:bg-transparent={viewMode !== 'servers'}
					class:text-[var(--color-text-dim)]={viewMode !== 'servers'}
					onclick={() => onViewModeChange('servers')}
				>
					Servers
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin">
			<div class="grid grid-cols-2 gap-2">
				{#each [[data.stats.total_friends, 'Friends'], [data.stats.total_connections, 'Connections'], [data.stats.clusters, 'Clusters'], [data.stats.isolated_count, 'Isolated']] as [value, label] (label)}
					<div class="bg-[var(--color-surface-raised)] rounded-md p-2.5 flex flex-col items-center">
						<span class="text-lg font-semibold">{value}</span>
						<span class="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest"
							>{label}</span
						>
					</div>
				{/each}
			</div>

			{#if topBridges.length > 0}
				<div>
					<button
						class="flex items-center gap-1 w-full py-1.5 text-[11px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-[var(--color-text-muted)] transition-colors"
						onclick={() => toggleSection('bridges')}
					>
						<svg
							class="w-3 h-3 transition-transform duration-150"
							class:rotate-[-90deg]={!expandedSections.bridges}
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M7 10l5 5 5-5z" />
						</svg>
						Bridging Risks
					</button>
					{#if expandedSections.bridges}
						<div class="flex flex-col gap-0.5">
							{#each topBridges as node (node.id)}
								<button
									class="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm bg-transparent border-none text-[var(--color-text-muted)] text-left cursor-pointer w-full font-[inherit] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] transition-colors"
									onclick={() => onNodeClick(node)}
								>
									{#if node.avatar}
										<img
											src={node.avatar}
											alt=""
											crossorigin="anonymous"
											class="w-5 h-5 rounded-full shrink-0 object-cover"
										/>
									{:else}
										<div
											class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold text-white"
											style="background: {clusterColor(node.cluster)}"
										>
											{(node.username || '?')[0].toUpperCase()}
										</div>
									{/if}
									<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
										>{node.username}</span
									>
									<span
										class="text-[11px] font-medium shrink-0"
										style="color: {bridgingColor(node.bridging_score)}"
									>
										{node.bridging_score.toFixed(3)}
									</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div>
				<button
					class="flex items-center gap-1 w-full py-1.5 text-[11px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-[var(--color-text-muted)] transition-colors"
					onclick={() => toggleSection('clusters')}
				>
					<svg
						class="w-3 h-3 transition-transform duration-150"
						class:rotate-[-90deg]={!expandedSections.clusters}
						viewBox="0 0 24 24"
						fill="currentColor"
					>
						<path d="M7 10l5 5 5-5z" />
					</svg>
					{viewMode === 'servers' ? 'Server Groups' : 'Clusters'}
				</button>
				{#if expandedSections.clusters}
					<div class="flex flex-col gap-0.5">
						{#each clusterGroups as [cluster, members] (cluster)}
							<button
								class="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm bg-transparent border-none text-[var(--color-text-muted)] text-left cursor-pointer w-full font-[inherit] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] transition-colors"
								class:opacity-35={hiddenClusters.has(cluster)}
								onclick={() => onToggleCluster(cluster)}
							>
								<span
									class="w-2 h-2 rounded-full shrink-0"
									style="background: {clusterColor(cluster)}"
								></span>
								<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
									{#if viewMode === 'servers'}
										{cluster < 0
											? 'No Server'
											: (clusterServerName.get(cluster) ?? `Server ${cluster}`)}
									{:else}
										{cluster < 0 ? 'Unclustered' : `Cluster ${cluster}`}
									{/if}
								</span>
								<span class="text-[11px] font-medium text-[var(--color-text-dim)]"
									>{members.length}</span
								>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div>
				<button
					class="flex items-center gap-1 w-full py-1.5 text-[11px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-[var(--color-text-muted)] transition-colors"
					onclick={() => toggleSection('isolated')}
				>
					<svg
						class="w-3 h-3 transition-transform duration-150"
						class:rotate-[-90deg]={!expandedSections.isolated}
						viewBox="0 0 24 24"
						fill="currentColor"
					>
						<path d="M7 10l5 5 5-5z" />
					</svg>
					Isolated ({isolated.length})
				</button>
				{#if expandedSections.isolated}
					<div class="flex flex-col gap-0.5">
						{#each isolated.slice(0, 15) as node (node.id)}
							<button
								class="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm bg-transparent border-none text-[var(--color-text-muted)] text-left cursor-pointer w-full font-[inherit] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] transition-colors"
								onclick={() => onNodeClick(node)}
							>
								{#if node.avatar}
									<img
										src={node.avatar}
										alt=""
										crossorigin="anonymous"
										class="w-5 h-5 rounded-full shrink-0 object-cover"
									/>
								{:else}
									<div
										class="w-5 h-5 rounded-full shrink-0 bg-[var(--color-surface-raised)] flex items-center justify-center text-[9px] font-semibold text-[var(--color-text-dim)]"
									>
										{(node.username || '?')[0].toUpperCase()}
									</div>
								{/if}
								<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
									>{node.username}</span
								>
							</button>
						{/each}
						{#if isolated.length > 15}
							<div class="text-[11px] text-[var(--color-text-dim)] px-2.5 py-1">
								+{isolated.length - 15} more
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div>
				<button
					class="flex items-center gap-1 w-full py-1.5 text-[11px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-[var(--color-text-muted)] transition-colors"
					onclick={() => toggleSection('servers')}
				>
					<svg
						class="w-3 h-3 transition-transform duration-150"
						class:rotate-[-90deg]={!expandedSections.servers}
						viewBox="0 0 24 24"
						fill="currentColor"
					>
						<path d="M7 10l5 5 5-5z" />
					</svg>
					Shared Servers
				</button>
				{#if expandedSections.servers}
					<div class="flex flex-col gap-0.5">
						{#each serverCounts as [serverId, count] (serverId)}
							{@const server = data.servers[serverId]}
							<div
								class="flex items-center gap-2 px-2.5 py-1.5 text-sm text-[var(--color-text-muted)]"
							>
								{#if server?.icon}
									<img
										src={server.icon}
										alt=""
										crossorigin="anonymous"
										class="w-5 h-5 rounded-full shrink-0 object-cover"
									/>
								{:else}
									<div
										class="w-5 h-5 rounded-full shrink-0 bg-[var(--color-surface-raised)] flex items-center justify-center text-[9px] font-semibold text-[var(--color-text-dim)]"
									>
										{(server?.name ?? '?')[0]}
									</div>
								{/if}
								<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs"
									>{server?.name ?? serverId}</span
								>
								<span class="text-[11px] font-medium shrink-0">{count}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="mt-auto pt-3 border-t border-[var(--color-border)]">
				<FetchPanel onComplete={onFetch} />
			</div>
		</div>
	{:else}
		<div class="flex-1 flex flex-col items-center justify-center px-6 gap-4">
			<div class="text-center">
				<div class="text-sm font-medium text-[var(--color-text)] mb-1">No data loaded</div>
				<div class="text-xs text-[var(--color-text-dim)] leading-relaxed">
					Run the Howl collector in Discord
				</div>
			</div>
			<div class="w-full">
				<FetchPanel onComplete={onFetch} />
			</div>
		</div>
	{/if}
</aside>
