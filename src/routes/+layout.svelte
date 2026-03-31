<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(() => theme.init());
</script>

{@render children()}
