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

import { readdir, mkdir, writeFile, readFile } from "fs/promises";
import { extname, basename, resolve } from "path";
import type { RemoteEmoji, GlyphEntry, GlyphConfig } from "../types";
import { IGNORED_EXTENSIONS, LIST_FILE, TYPES_FILE } from "../constants";

export async function scanLocalEmojis(cfg: GlyphConfig): Promise<Array<string>> {
    const dir = resolve(cfg.emojisDir);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const out = new Set<string>();

    for (const e of entries) {
        if (!e.isFile()) continue;

        const ext = extname(e.name).toLowerCase();

        if (IGNORED_EXTENSIONS.includes(ext)) continue;

        const base = basename(e.name, ext);
        out.add(base);
    }

    return [...out].sort((a, b) => a.localeCompare(b));
}

export type LocalEmojiFile = {
    name: string;
    filePath: string;
    ext: string;
};

export async function listLocalEmojiFiles(
    cfg: GlyphConfig
): Promise<Array<LocalEmojiFile>> {
    const dir = resolve(cfg.emojisDir);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: Array<LocalEmojiFile> = [];

    for (const e of entries) {
        if (!e.isFile()) continue;

        const ext = extname(e.name).toLowerCase();

        if (IGNORED_EXTENSIONS.includes(ext)) continue;

        const base = basename(e.name, ext);

        files.push({
            name: base,
            filePath: resolve(dir, e.name),
            ext
        });
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
}

export function diffEmojis(local: Array<string>, remoteNames: Array<string>) {
    const localSet = new Set(local);
    const remoteSet = new Set(remoteNames);

    const toUpload = local.filter((n) => !remoteSet.has(n));
    const toDelete = remoteNames.filter((n) => !localSet.has(n));

    const kept = local.filter((n) => remoteSet.has(n));

    return { toUpload, toDelete, kept };
}

export function toIdentifier(name: string, id: string, animated?: boolean) {
    return `<${animated ? "a" : ""}:${name}:${id}>`;
}

export async function safeDirAction(cfg: GlyphConfig): Promise<string> {
    const dir = resolve(cfg.emojisDir);
    await mkdir(dir, { recursive: true })

    return dir;
}

export async function writeTypesFile(dir: string, list: Array<string>) {
    const dts =
        `declare module "glyph/emojis" {\n` +
        `  export type Emojis = ${list.length ? list.map((e) => `'${e}'`).join(" | ") : "never"};\n` +
        `  export type EmojisRecord = Record<Emojis, { id: string; name: string; identifier: string }>;\n` +
        `}\n`;

    return writeFile(resolve(dir, TYPES_FILE), dts + "\n", "utf8");
}

export async function writeIndexFiles(
    remote: Array<RemoteEmoji>,
    cfg: GlyphConfig
): Promise<void> {
    const dir = await safeDirAction(cfg);

    const list: Array<GlyphEntry> = remote
        .map((e) => ({
            id: e.id,
            name: e.name,
            identifier: toIdentifier(e.name, e.id, e.animated),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    await writeFile(
        resolve(dir, LIST_FILE),
        JSON.stringify(list, null, 2),
        "utf8"
    );

    await writeTypesFile(dir, list.map((e) => e.name));
}

export async function fileToBase64(path: string): Promise<string> {
    const buf = await readFile(path);
    return buf.toString("base64");
}