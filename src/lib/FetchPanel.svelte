<script lang="ts">
	import { onMount } from 'svelte';
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import type { GraphData } from './types';
	import { processRawData } from './data-processing';

	hljs.registerLanguage('javascript', javascript);

	let {
		onComplete = () => {},
	}: {
		onComplete?: (data: GraphData) => void;
	} = $props();

	let status: 'idle' | 'listening' | 'done' = $state('idle');
	let showModal = $state(false);
	let copied = $state(false);
	let script = $state('');
	let highlighted = $derived(
		script ? hljs.highlight(script, { language: 'javascript' }).value : '',
	);
	let pollVersion = 0;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		fetch('/howl.js')
			.then((r) => (r.ok ? r.text() : ''))
			.then((t) => (script = t))
			.catch(() => {});
		checkIngest();
		startPolling();
		return () => stopPolling();
	});

	function startPolling() {
		if (pollTimer) return;
		status = status === 'done' ? 'done' : 'listening';
		pollTimer = setInterval(checkIngest, 2000);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	async function checkIngest() {
		try {
			const resp = await fetch(`/api/ingest?v=${pollVersion}`);
			if (resp.status === 200) {
				const json = await resp.json();
				pollVersion = json.v;
				status = 'done';
				onComplete(processRawData(json.data));
			}
		} catch {}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showModal) showModal = false;
	}

	async function copyScript() {
		await navigator.clipboard.writeText(script);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex items-center justify-between">
	<button
		onclick={() => (showModal = true)}
		class="text-[11px] font-medium text-[var(--color-text-dim)] bg-transparent border-none cursor-pointer hover:text-[var(--color-text-muted)] transition-colors underline decoration-dotted underline-offset-2"
	>
		Collect new data
	</button>
	{#if status === 'done'}
		<span class="text-[11px] text-[var(--color-success)]">Ready</span>
	{:else if status === 'listening'}
		<span class="text-[11px] text-[var(--color-text-dim)]">Listening...</span>
	{/if}
</div>

{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		onclick={() => (showModal = false)}
		role="dialog"
	>
		<div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
		<div
			class="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="px-5 py-4 space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-[var(--color-text)]">Howl Collector</h2>
					<button
						onclick={() => (showModal = false)}
						class="w-6 h-6 flex items-center justify-center rounded bg-transparent border-none text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-text)] transition-colors"
					>
						<svg
							class="w-3.5 h-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="relative">
					<pre
						class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 text-[11px] overflow-auto max-h-[240px] font-mono leading-relaxed"><code
							>{@html highlighted || 'Loading...'}</code
						></pre>
					<button
						onclick={copyScript}
						disabled={!script}
						class="absolute top-2 right-2 px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
					>
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>

				<p class="text-[11px] text-[var(--color-text-dim)]">
					Paste in Discord console. Refresh this page when done.
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.hljs-keyword) {
		color: #c678dd;
	}
	:global(.hljs-string) {
		color: #98c379;
	}
	:global(.hljs-number) {
		color: #d19a66;
	}
	:global(.hljs-built_in) {
		color: #e5c07b;
	}
	:global(.hljs-function) {
		color: #61afef;
	}
	:global(.hljs-params) {
		color: #abb2bf;
	}
	:global(.hljs-comment) {
		color: #5c6370;
		font-style: italic;
	}
	:global(.hljs-literal) {
		color: #d19a66;
	}
	:global(.hljs-property) {
		color: #e06c75;
	}
	:global(.hljs-attr) {
		color: #d19a66;
	}
	:global(.hljs-title) {
		color: #61afef;
	}
	:global(.hljs-regexp) {
		color: #98c379;
	}
</style>
