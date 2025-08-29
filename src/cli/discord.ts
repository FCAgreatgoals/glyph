/**
 * This file is part of glyph (https://github.com/FCAgreatgoals/glyph.git).
 *
 * Copyright (C) 2025 SAS French Community Agency
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type { RemoteEmoji } from "../types";

function authHeaders(token: string) {
	return {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
	};
}

export async function getBotUser(botToken: string) {
	const res = await fetch("https://discord.com/api/v10/users/@me", {
		headers: { Authorization: `Bot ${botToken}` },
	});
	if (!res.ok) throw new Error(`getBotUser failed: ${res.status}`);
	return (await res.json()) as { id: string };
}

export async function listAppEmojis(
	botToken: string,
	appId: string
): Promise<RemoteEmoji[]> {
	const res = await fetch(
		`https://discord.com/api/v10/applications/${appId}/emojis`,
		{ headers: { Authorization: `Bot ${botToken}` } }
	);
	if (!res.ok) throw new Error(`listAppEmojis failed: ${res.status}`);
	const json = await res.json();
	const items = Array.isArray(json?.items) ? json.items : [];
	return items.map((e: any) => ({
		id: String(e.id),
		name: String(e.name),
		animated: !!e.animated,
	}));
}

export async function deleteAppEmoji(
	botToken: string,
	appId: string,
	emojiId: string
) {
	const res = await fetch(
		`https://discord.com/api/v10/applications/${appId}/emojis/${emojiId}`,
		{ method: "DELETE", headers: authHeaders(botToken) }
	);
	if (!res.ok)
		throw new Error(`deleteAppEmoji ${emojiId} failed: ${res.status}`);
}

export async function uploadAppEmoji(
	botToken: string,
	appId: string,
	name: string,
	imageBase64: string, // base64 sans prefix
	mimeType = "image/png"
): Promise<RemoteEmoji> {
	const body = {
		name,
		image: `data:${mimeType};base64,${imageBase64}`,
	};

	const res = await fetch(
		`https://discord.com/api/v10/applications/${appId}/emojis`,
		{
			method: "POST",
			headers: authHeaders(botToken),
			body: JSON.stringify(body),
		}
	);

	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json?.id) {
		throw new Error(
			`uploadAppEmoji ${name} failed: ${res.status} ${JSON.stringify(json)}`
		);
	}

	return {
		id: json.id,
		name: json.name ?? name,
		animated: json.animated,
	};
}