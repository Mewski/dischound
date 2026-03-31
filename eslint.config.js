import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'svelte/require-each-key': 'warn',
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/no-at-html-tags': 'off',
		},
	},
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', 'static/howl.js'],
	},
);
