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
    readFile
} from "fs/promises";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { extname, basename, resolve } from "path";

import { EMOJI_NAME_REGEX, EXTENSIONS, LIST_FILE, LOCK_FILE, RETIRED_NAME_REGEX, TYPES_FILE } from "../constants";

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
 * remplacer des emojis à la main, même inchangés.
 */
export function matchesAny(name: string, patterns: Array<string>): boolean {
    return patterns.some(pattern => new RegExp(`^${pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name));
}

export type GlyphLock = {
    appId: string;
    emojis: Record<string, { id: string, hash: string }>;
};

export function hashBuffer(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

export async function hashFile(path: string): Promise<string> {
    return hashBuffer(await readFile(path));
}

const execFileAsync = promisify(execFile);

// `--since <ref>` : le commit doit exister avant toute écriture, sinon chaque emoji paraîtrait inchangé.
export async function resolveGitRef(cfg: GlyphConfig, ref: string): Promise<string> {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: resolve(cfg.emojisDir) })
        .catch(() => { throw new Error(`--since: "${ref}" is not a commit of this git repository`); });
    return stdout.trim();
}

// Le fichier tel qu'il était à ce commit, ou null s'il n'existait pas encore.
export async function fileAtRef(cfg: GlyphConfig, commit: string, fileName: string): Promise<Buffer | null> {
    return execFileAsync("git", ["show", `${commit}:./${fileName}`], { cwd: resolve(cfg.emojisDir), encoding: "buffer", maxBuffer: 64 * 1024 * 1024 })
        .then(({ stdout }) => stdout)
        .catch(() => null);
}

// L'état d'une autre application (jeton changé) ne dit rien de celle-ci : on repart de zéro.
export async function readLock(cfg: GlyphConfig, appId: string): Promise<GlyphLock> {
    const raw = await readFile(resolve(cfg.emojisDir, LOCK_FILE), "utf8").catch(() => null);
    const lock = raw ? JSON.parse(raw) as GlyphLock : null;

    return lock?.appId === appId ? lock : { appId, emojis: {} };
}

export async function writeLock(cfg: GlyphConfig, lock: GlyphLock): Promise<void> {
    const dir = await safeDirAction(cfg);
    const emojis = Object.fromEntries(Object.entries(lock.emojis).sort(([a], [b]) => a.localeCompare(b)));

    await writeFile(resolve(dir, LOCK_FILE), JSON.stringify({ appId: lock.appId, emojis }, null, 2) + "\n", "utf8");
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