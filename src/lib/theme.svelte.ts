const STORAGE_KEY = 'theme';

type Theme = 'dark' | 'light';

let current: Theme = $state('dark');

function apply(theme: Theme) {
	current = theme;
	document.documentElement.dataset.theme = theme;
	localStorage.setItem(STORAGE_KEY, theme);
}

function init() {
	const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
	const preferred =
		stored ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
	apply(preferred);
}

function toggle() {
	apply(current === 'dark' ? 'light' : 'dark');
}

export const theme = {
	get current() {
		return current;
	},
	init,
	toggle,
};
