<script lang="ts">
	import type { GraphNode } from './types';

	let {
		nodes = [],
		onSearch = () => {},
	}: {
		nodes?: GraphNode[];
		onSearch?: (ids: Set<string>) => void;
	} = $props();

	let query = $state('');

	function strip(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	let strippedNodes = $derived(
		nodes.map((n) => ({
			id: n.id,
			username: strip(n.username),
			displayName: strip(n.display_name),
		})),
	);

	let noResults = $state(false);

	$effect(() => {
		if (!query.trim()) {
			noResults = false;
			onSearch(new Set());
			return;
		}
		const q = strip(query);
		const ids = new Set(
			strippedNodes
				.filter((n) => n.username.includes(q) || n.displayName.includes(q))
				.map((n) => n.id),
		);
		noResults = ids.size === 0;
		if (ids.size === 0) ids.add('__no_match__');
		onSearch(ids);
	});
</script>

<div
	class="flex items-center gap-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded px-2.5 py-1.5"
>
	<svg
		class="w-4 h-4 shrink-0 text-[var(--color-text-dim)]"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		<circle cx="11" cy="11" r="8" />
		<path d="M21 21l-4.35-4.35" />
	</svg>
	<input
		type="text"
		bind:value={query}
		placeholder="Search"
		aria-label="Search users"
		class="bg-transparent border-none outline-none text-[var(--color-text)] font-sans text-sm w-full placeholder:text-[var(--color-text-dim)]"
	/>
	{#if noResults}
		<span class="text-[11px] text-[var(--color-text-dim)] shrink-0">No results</span>
	{/if}
</div>
