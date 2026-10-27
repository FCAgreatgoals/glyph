/**
 * This file is part of Glyph (https://github.com/FCAgreatgoals/glyph).
 *
 * Copyright (C) 2026 SAS French Community Agency
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
 *
 * Additional permission under the AGPL-3.0 section 7:
 * You may use this library as a dependency in your own application without
 * your application being subject to the AGPL-3.0. Only modifications to
 * Glyph itself must be made publicly available. See LINKING_EXCEPTION.md
 * for full details.
 */

import { DISCORD_API_USERS_ME, DISCORD_API_APP_EMOJIS, DISCORD_API_APP_EMOJI } from "../constants";

import type { RemoteEmoji } from "../types";

const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_RATE_LIMIT_WAIT_S = 120;

// 429 : Discord dit combien attendre (`retry_after`, en secondes). Un remplacement en masse y passe forcément.
async function discordFetch(url: string, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, init);
        if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return res;

        const body = await res.clone().json().catch(() => ({}));
        const wait = Number(body?.retry_after ?? res.headers.get("retry-after") ?? 1);
        if (wait > MAX_RATE_LIMIT_WAIT_S) return res;

        console.log(`    … rate limited, retrying in ${wait.toFixed(1)}s`);
        await new Promise(r => setTimeout(r, wait * 1000 + 50));
    }
}

function authHeaders(token: string) {
    return {
        Authorization: `Bot ${token}`,
    };
}

function authHeadersWithJson(token: string) {
    return {
        ...authHeaders(token),
        "Content-Type": "application/json",
    };
}

export async function getBotUser(botToken: string, api?: string) {
    const res = await discordFetch(DISCORD_API_USERS_ME(api), {
        headers: authHeaders(botToken),
    });
    if (!res.ok) throw new Error(`getBotUser failed: ${res.status}`);

    return (await res.json()) as { id: string };
}

export async function listAppEmojis(
    botToken: string,
    appId: string,
    api?: string
): Promise<Array<RemoteEmoji>> {
    const res = await discordFetch(
        DISCORD_API_APP_EMOJIS(appId, api),
        { headers: authHeaders(botToken) }
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
    emojiId: string,
    api?: string
) {
    const res = await discordFetch(
        DISCORD_API_APP_EMOJI(appId, emojiId, api),
        { method: "DELETE", headers: authHeadersWithJson(botToken) }
    );

    if (!res.ok)
        throw new Error(`deleteAppEmoji ${emojiId} failed: ${res.status}`);
}

export async function renameAppEmoji(
    botToken: string,
    appId: string,
    emojiId: string,
    name: string,
    api?: string
) {
    const res = await discordFetch(
        DISCORD_API_APP_EMOJI(appId, emojiId, api),
        {
            method: "PATCH",
            headers: authHeadersWithJson(botToken),
            body: JSON.stringify({ name }),
        }
    );

    if (!res.ok)
        throw new Error(`renameAppEmoji ${emojiId} failed: ${res.status}`);
}

export async function uploadAppEmoji(
    botToken: string,
    appId: string,
    name: string,
    imageBase64: string, // base64 without prefix
    mimeType: string = "image/png",
    api?: string
): Promise<RemoteEmoji> {
    const body = {
        name,
        image: `data:${mimeType};base64,${imageBase64}`,
    };

    const res = await discordFetch(
        DISCORD_API_APP_EMOJIS(appId, api),
        {
            method: "POST",
            headers: authHeadersWithJson(botToken),
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