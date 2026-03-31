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

	$effect(() => {
		if (!query.trim()) {
			onSearch(new Set());
			return;
		}
		const q = query.toLowerCase();
		const ids = new Set(
			nodes
				.filter(
					(n) => n.username.toLowerCase().includes(q) || n.display_name.toLowerCase().includes(q),
				)
				.map((n) => n.id),
		);
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
		class="bg-transparent border-none outline-none text-[var(--color-text)] font-sans text-sm w-full placeholder:text-[var(--color-text-dim)]"
	/>
</div>
