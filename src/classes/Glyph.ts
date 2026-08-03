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

import { readFileSync } from "fs";
import { resolve } from "path";
import { LIST_FILE } from "../constants";
import { loadConfig } from "../cli/GlyphConfig";

import type { GlyphEntry } from "../types";
import type { Emojis } from "glyph/emojis";

export class Glyph {

    private static instance: Glyph;
    private entries: Map<Emojis, GlyphEntry>

    constructor(list: Array<GlyphEntry>) {
        this.entries = new Map(list.map(e => [e.name, e]));
    }

    public static init() {
        if (Glyph.instance) throw new Error("Glyph already Initialized");

        const config = loadConfig()

        const list = JSON.parse(
            readFileSync(resolve(config.emojisDir, LIST_FILE), "utf-8")
        ) as Array<GlyphEntry>;

        Glyph.instance = new Glyph(list);
    }

    private static ensure(): Glyph {
        if (!Glyph.instance) throw new Error("Glyph not initialized");
        return Glyph.instance;
    }

    public static get(name: Emojis): GlyphEntry {
        return Glyph.ensure().entries.get(name) as GlyphEntry;
    }

    public static size(): number {
        return Glyph.ensure().entries.size;
    }

    public static list(): Array<GlyphEntry> {
        return [...Glyph.ensure().entries.values()];
    }

    public static has(name: Emojis): boolean {
        return Glyph.ensure().entries.has(name);
    }

    public static toIdentifier(emoji: GlyphEntry): string {
        return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
    }

    public static identifier(name: Emojis): string {
        return this.toIdentifier(this.get(name));
    }

    // Identifiant compact : le nom est réduit à `_`. Rendu identique côté Discord, mais markup plus
    // court (`<:_:id>`) — utile quand beaucoup d'emoji doivent tenir sous la limite de taille des
    // composants/messages.
    public static toCompact(emoji: GlyphEntry): string {
        return `<${emoji.animated ? "a" : ""}:_:${emoji.id}>`;
    }

    public static compact(name: Emojis): string {
        return this.toCompact(this.get(name));
    }

    public static id(name: Emojis): string {
        return this.get(name).id;
    }
}
