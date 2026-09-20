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

import { existsSync } from "fs";
import { resolve } from "path";

import { CONFIG_FILE, DEFAULT_EMOJIS_DIR, DISCORD_API_BASE_URL, normalizeApiBaseUrl } from "../constants";

import type { GlyphConfig } from "../types";

// Default configuration
export const DEFAULT_CONFIG: GlyphConfig = {
    emojisDir: DEFAULT_EMOJIS_DIR,
    fileIndex: true,
    botToken: undefined,
    apiBaseUrl: DISCORD_API_BASE_URL,
}

/*
 * Ne garde que les valeurs reellement fournies.
 *
 * Un fichier de configuration route lui-meme l'environnement, comme le fait le
 * modele avec `process.env.TOKEN`. Quand la variable n'est pas definie, la cle
 * existe malgre tout et vaut `undefined` : sans ce filtre, elle ecraserait la
 * valeur par defaut, et `apiBaseUrl` se retrouverait a `undefined` au lieu de
 * l'API de Discord. Seuls `undefined` et la chaine vide sont ecartes, jamais
 * `false`, qui est un choix.
 */
function present<T extends object>(source: T): Partial<T> {
    const out: Partial<T> = {};

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined || value === "") continue;

        out[key as keyof T] = value as T[keyof T];
    }

    return out;
}

export function loadConfig(): GlyphConfig {
    const configPath = resolve(CONFIG_FILE);

    const merged: GlyphConfig = existsSync(configPath)
        ? {
            ...DEFAULT_CONFIG,
            ...present(require(configPath).default as Partial<GlyphConfig>),
        }
        : {
            ...DEFAULT_CONFIG,
            ...present({
                emojisDir: process.env.EMOJIS_DIR,
                botToken: process.env.TOKEN,
                apiBaseUrl: process.env.DISCORD_API,
            }),
        };

    // La normalisation se fait une fois, sur la valeur qui a gagne, d'ou
    // qu'elle vienne : une barre finale de trop produit sinon des `//` au
    // milieu des chemins, que certains proxies refusent.
    return { ...merged, apiBaseUrl: normalizeApiBaseUrl(merged.apiBaseUrl) };
}
