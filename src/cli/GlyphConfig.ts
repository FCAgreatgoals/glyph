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

import { CONFIG_FILE, DEFAULT_EMOJIS_DIR } from "../constants";

import type { GlyphConfig } from "../types";

// Default configuration
export const DEFAULT_CONFIG: GlyphConfig = {
    emojisDir: DEFAULT_EMOJIS_DIR,
    fileIndex: true,
    botToken: undefined,
}

export function loadConfig(): GlyphConfig {
    const configPath = resolve(CONFIG_FILE);

    if (existsSync(configPath)) {
        const config = require(configPath).default as Partial<GlyphConfig>;

        return {
            ...DEFAULT_CONFIG,
            ...config,
        };
    }

    return {
        ...DEFAULT_CONFIG,
        ...(process.env.EMOJIS_DIR ? { emojisDir: process.env.EMOJIS_DIR } : {}),
        ...(process.env.TOKEN ? { botToken: process.env.TOKEN } : {})
    }
}
