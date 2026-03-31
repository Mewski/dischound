(async () => {
	const INGEST = "http://127.0.0.1:5173/api/ingest";
	const API = "https://discord.com/api/v9";

	function isToken(s) {
		return typeof s === "string" && s.length > 40 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(s);
	}

	function extractToken() {
		try {
			const candidates = [];
			webpackChunkdiscord_app.push([[Date.now()], {}, (r) => {
				for (const id of Object.keys(r.c)) {
					const m = r.c[id]?.exports;
					if (typeof m?.default?.getToken === "function") candidates.push(m.default.getToken);
					if (typeof m?.getToken === "function") candidates.push(m.getToken);
				}
			}]);
			for (const fn of candidates) {
				try { const t = fn(); if (isToken(t)) return t; } catch {}
			}
		} catch {}
		try {
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const t = JSON.parse(f.contentWindow.localStorage.token);
			f.remove();
			if (isToken(t)) return t;
		} catch {}
		try { const t = JSON.parse(localStorage.token); if (isToken(t)) return t; } catch {}
		return null;
	}

	async function api(path, headers) {
		for (;;) {
			const r = await fetch(`${API}/${path}`, { headers });
			if (r.status === 429) {
				const wait = (await r.json()).retry_after ?? 2;
				console.log(`[howl] rate limited ${wait}s`);
				await new Promise(r => setTimeout(r, wait * 1000));
				continue;
			}
			if (!r.ok) throw new Error(`${r.status} ${path}`);
			return r.json();
		}
	}

	async function send(payload) {
		await fetch(INGEST, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	}

	const token = extractToken();
	if (!token) { console.error("[howl] token not found"); return; }
	console.log("[howl] token ok");

	const h = { Authorization: token };
	const [rel, gl] = await Promise.all([api("users/@me/relationships", h), api("users/@me/guilds", h)]);

	const servers = {};
	for (const g of gl)
		servers[g.id] = { name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=64` : null };

	const friends = rel.filter(r => r.type === 1);
	console.log(`[howl] ${friends.length} friends`);

	const nodes = [];
	for (let i = 0; i < friends.length; i++) {
		const f = friends[i];
		await new Promise(r => setTimeout(r, 1200));

		let mutuals = [], guilds = [];
		try {
			const p = await api(`users/${f.id}/profile?with_mutual_guilds=true&with_mutual_friends=true`, h);
			if (Array.isArray(p.mutual_friends)) mutuals = p.mutual_friends.map(m => m.id);
			if (Array.isArray(p.mutual_guilds)) guilds = p.mutual_guilds.map(g => ({ id: g.id, nick: g.nick }));
		} catch (e) { console.warn(`[howl] ${f.user.username}: ${e.message}`); }

		const av = f.user.avatar;
		const avatar = av
			? `https://cdn.discordapp.com/avatars/${f.id}/${av}.webp?size=128`
			: `https://cdn.discordapp.com/embed/avatars/${(BigInt(f.id) >> 22n) % 6n}.png`;
		nodes.push({
			id: f.id,
			username: f.user.username,
			display_name: f.user.global_name ?? f.user.username,
			avatar,
			mutuals, guilds,
		});

		console.log(`[howl] ${i + 1}/${friends.length} ${f.user.username}`);
		if ((i + 1) % 5 === 0 || i === friends.length - 1) await send({ nodes, servers });
	}

	console.log(`[howl] done`);
})();
