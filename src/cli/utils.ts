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

import {
    readdir,
    mkdir,
    writeFile,
    readFile,
    realpath
} from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { extname, basename, dirname, relative, resolve } from "path";

import { DISCORD_EPOCH, EMOJI_NAME_REGEX, EXTENSIONS, LIST_FILE, RETIRED_NAME_REGEX, TYPES_FILE } from "../constants";

import type { RemoteEmoji, GlyphEntry, GlyphConfig } from "../types";

export async function scanLocalEmojis(cfg: GlyphConfig): Promise<Array<string>> {
    const dir = resolve(cfg.emojisDir);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const out = new Set<string>();

    for (const e of entries) {
        if (!e.isFile()) continue;

        const ext = extname(e.name).toLowerCase();

        if (!EXTENSIONS[ext]) continue;

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

/**
 * Noms que Discord refusera, avec le nom corrige a proposer. Verifie avant toute requete : la
 * synchronisation supprime avant d'envoyer, et echouer au milieu laisse l'application dans un etat
 * que personne n'a demande.
 */
export function invalidEmojiNames(names: Array<string>): Array<{ name: string, suggestion: string }> {
    return names
        .filter(name => !EMOJI_NAME_REGEX.test(name) || RETIRED_NAME_REGEX.test(name))
        .map(name => ({
            name,
            suggestion: RETIRED_NAME_REGEX.test(name) ? `emoji_${name}` : name.replace(/\W/g, '_').slice(0, 32).padEnd(2, '_')
        }));
}

// Ancienne version d'un emoji gardée en ligne (`old_<id>`), hors index et hors synchronisation.
export function isRetired(name: string): boolean {
    return RETIRED_NAME_REGEX.test(name);
}

/*
 * `--rotate iconLog*,iconBan` : motifs séparés par des virgules, `*` pour n'importe quelle suite. Sert à
 * remplacer des emojis que git ne voit pas changés (dépôt absent ou superficiel).
 */
export function matchesAny(name: string, patterns: Array<string>): boolean {
    return patterns.some(pattern => new RegExp(`^${pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name));
}

// Date de création d'un emoji, inscrite dans son id (snowflake).
export function snowflakeTime(id: string): number {
    return Number(BigInt(id) >> BigInt(22)) + DISCORD_EPOCH;
}

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: Array<string>): Promise<string> {
    return (await execFileAsync("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

export type EmojiFileChanges =
    | { ok: true, changedAt: Map<string, number>, uncommitted: Set<string> }
    | { ok: false, reason: string };

/*
 * Dernier changement de chaque fichier du dossier sur la branche, par nom de fichier : date du commit qui
 * l'y a fait entrer (`--first-parent` : un merge compte à sa date, pas à celle du commit d'origine).
 * Postérieure à la création de l'emoji, elle dit que l'image en ligne n'est plus la bonne.
 */
export async function emojiFileChanges(cfg: GlyphConfig): Promise<EmojiFileChanges> {
    return readEmojiFileChanges(cfg).catch(err => ({ ok: false, reason: String(err?.stderr || err?.message || err).trim().split("\n").pop()! }));
}

async function readEmojiFileChanges(cfg: GlyphConfig): Promise<EmojiFileChanges> {
    const dir = await realpath(resolve(cfg.emojisDir)).catch(() => resolve(cfg.emojisDir));

    let root: string;
    try {
        root = (await git(dir, ["rev-parse", "--show-toplevel"])).trim();
    } catch {
        return { ok: false, reason: "not a git repository, or git is not installed" };
    }

    // Un clone superficiel date tous les fichiers de son plus vieux commit : tout paraîtrait changé.
    if ((await git(root, ["rev-parse", "--is-shallow-repository"])).trim() === "true")
        return { ok: false, reason: "shallow clone, the file history is incomplete" };

    const pathspec = relative(root, dir) || ".";
    const inDir = (path: string) => dirname(resolve(root, path)) === dir;

    const changedAt = new Map<string, number>();
    let date = 0;
    for (const line of (await git(root, ["log", "-m", "--first-parent", "--format=%x00%ct", "--name-only", "--", pathspec])).split("\n")) {
        if (line.startsWith("\0")) date = Number(line.slice(1)) * 1000;
        else if (line && inDir(line) && !changedAt.has(basename(line))) changedAt.set(basename(line), date);
    }

    const uncommitted = new Set<string>();
    const status = (await git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", pathspec])).split("\0");
    for (let i = 0; i < status.length; i++) {
        const path = status[i].slice(3);
        if (path && inDir(path)) uncommitted.add(basename(path));
        if (status[i][0] === "R" || status[i][0] === "C") i++;
    }

    return { ok: true, changedAt, uncommitted };
}

export async function listLocalEmojiFiles(
    cfg: GlyphConfig
): Promise<Array<LocalEmojiFile>> {
    const dir = resolve(cfg.emojisDir);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: Array<LocalEmojiFile> = [];

    for (const e of entries) {
        if (!e.isFile()) continue;

        const ext = extname(e.name).toLowerCase();

        if (!EXTENSIONS[ext]) continue;

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

export async function safeDirAction(cfg: GlyphConfig): Promise<string> {
    const dir = resolve(cfg.emojisDir);
    await mkdir(dir, { recursive: true })

    return dir;
}

export async function writeTypesFile(dir: string, list: Array<string>) {
    const dts =
        `declare module "glyph/emojis" {\n` +
        `  export type Emojis = ${list.length ? list.map((e) => `'${e}'`).join(" | ") : "never"};\n` +
        `  export type EmojisRecord = Record<Emojis, { id: string; name: string; animated: boolean }>;\n` +
        `}\n`;

    return writeFile(resolve(dir, TYPES_FILE), dts + "\n", "utf8");
}

export async function writeIndexFiles(
    remote: Array<RemoteEmoji>,
    cfg: GlyphConfig
): Promise<void> {
    const dir = await safeDirAction(cfg);

    const list: Array<GlyphEntry> = remote
        .filter((e) => !isRetired(e.name))
        .map((e) => ({
            id: e.id,
            name: e.name,
            animated: e.animated ?? false
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    await writeFile(
        resolve(dir, LIST_FILE),
        JSON.stringify(list),
        "utf8"
    );

    await writeTypesFile(dir, list.map((e) => e.name));
}

export async function fileToBase64(path: string): Promise<string> {
    const buf = await readFile(path);
    return buf.toString("base64");
}