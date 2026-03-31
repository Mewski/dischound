import type { RequestHandler } from './$types';

export const prerender = false;

let store: unknown = null;
let version = 0;

export const POST: RequestHandler = async ({ request }) => {
	store = await request.json();
	version++;
	return new Response('ok', {
		headers: { 'Access-Control-Allow-Origin': '*' },
	});
};

export const GET: RequestHandler = async ({ url }) => {
	const since = Number(url.searchParams.get('v') ?? 0);
	if (!store || version <= since) return new Response(null, { status: 204 });
	return new Response(JSON.stringify({ v: version, data: store }), {
		headers: { 'content-type': 'application/json' },
	});
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
};
