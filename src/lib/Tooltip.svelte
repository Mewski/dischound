<script lang="ts">
	import type { GraphNode } from './types';
	import { bridgingLabel, bridgingColor, clusterColor } from './graph-utils';

	let {
		node = null,
		x = 0,
		y = 0,
		viewMode = 'mutuals',
		clusterLabel = '',
	}: {
		node?: GraphNode | null;
		x?: number;
		y?: number;
		viewMode?: 'mutuals' | 'servers';
		clusterLabel?: string;
	} = $props();

	let clampedX = $derived(
		Math.min(x + 15, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 240),
	);
	let clampedY = $derived(
		Math.min(y - 10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200),
	);
</script>

{#if node}
	<div
		class="fixed z-50 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-2.5 min-w-[200px] max-w-[280px] shadow-xl pointer-events-none font-sans"
		style="left: {clampedX}px; top: {Math.max(8, clampedY)}px;"
	>
		<div class="flex items-center gap-2.5 mb-2 pb-2 border-b border-[var(--color-border)]">
			{#if node.avatar}
				<img
					src={node.avatar}
					alt={node.username}
					crossorigin="anonymous"
					class="w-8 h-8 rounded-full object-cover"
					onerror={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = 'none';
					}}
				/>
			{:else}
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
					style="background: {clusterColor(node.cluster)}"
				>
					{(node.username || '?')[0].toUpperCase()}
				</div>
			{/if}
			<div class="min-w-0">
				<div class="text-sm font-semibold text-[var(--color-text)] truncate">
					{node.display_name}
				</div>
				<div class="text-[11px] text-[var(--color-text-dim)] truncate">@{node.username}</div>
			</div>
		</div>

		<div class="flex flex-col gap-1 text-[11px]">
			<div class="flex justify-between">
				<span class="text-[var(--color-text-dim)]"
					>{viewMode === 'servers' ? 'Server' : 'Cluster'}</span
				>
				<span class="text-[var(--color-text)] font-medium flex items-center gap-1">
					<span
						class="w-1.5 h-1.5 rounded-full inline-block"
						style="background: {clusterColor(node.cluster)}"
					></span>
					{clusterLabel || `#${node.cluster}`}
				</span>
			</div>
			{#if node.bridging_score > 0 && viewMode === 'mutuals'}
				<div class="flex justify-between">
					<span class="text-[var(--color-text-dim)]">Bridging</span>
					<span class="font-medium" style="color: {bridgingColor(node.bridging_score)}">
						{bridgingLabel(node.bridging_score)} ({node.bridging_score.toFixed(3)})
					</span>
				</div>
			{/if}
			<div class="flex justify-between">
				<span class="text-[var(--color-text-dim)]">Mutuals</span>
				<span class="text-[var(--color-text)] font-medium">{node.mutuals.length}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-[var(--color-text-dim)]">Servers</span>
				<span class="text-[var(--color-text)] font-medium">{node.guilds.length}</span>
			</div>
		</div>
	</div>
{/if}
