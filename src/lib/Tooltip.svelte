<script lang="ts">
	import type { GraphNode } from './types';
	import { bridgingLabel, bridgingColor, clusterColor } from './graph-utils';

	let {
		node = null,
		x = 0,
		y = 0,
	}: {
		node?: GraphNode | null;
		x?: number;
		y?: number;
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
		class="fixed z-50 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-3 min-w-[200px] shadow-xl pointer-events-none font-sans"
		style="left: {clampedX}px; top: {Math.max(8, clampedY)}px;"
	>
		<div class="flex items-center gap-2.5 mb-2 pb-2 border-b border-[var(--color-border)]">
			{#if node.avatar}
				<img
					src={node.avatar}
					alt={node.username}
					crossorigin="anonymous"
					class="w-9 h-9 rounded-full object-cover"
				/>
			{:else}
				<div
					class="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-base text-white"
					style="background: {clusterColor(node.cluster)}"
				>
					{(node.username || '?')[0].toUpperCase()}
				</div>
			{/if}
			<div>
				<div class="font-semibold text-sm text-[var(--color-text)]">{node.display_name}</div>
				<div class="text-xs text-[var(--color-text-dim)]">@{node.username}</div>
			</div>
		</div>

		<div class="flex flex-col gap-1 text-xs">
			<div class="flex justify-between">
				<span class="text-[var(--color-text-dim)]">Cluster</span>
				<span class="text-[var(--color-text)] font-medium flex items-center gap-1">
					<span
						class="w-2 h-2 rounded-full inline-block"
						style="background: {clusterColor(node.cluster)}"
					></span>
					#{node.cluster}
				</span>
			</div>
			{#if node.bridging_score > 0}
				<div class="flex justify-between">
					<span class="text-[var(--color-text-dim)]">Bridging</span>
					<span class="font-medium" style="color: {bridgingColor(node.bridging_score)}">
						{bridgingLabel(node.bridging_score)} ({node.bridging_score.toFixed(4)})
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
