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

import { Command } from "commander";
import { basename } from "path";

import { loadConfig } from "../GlyphConfig";
import {
    scanLocalEmojis,
    invalidEmojiNames,
    listLocalEmojiFiles,
    diffEmojis,
    writeIndexFiles,
    fileToBase64,
    safeDirAction,
    writeTypesFile,
    fileAtRef,
    hashBuffer,
    hashFile,
    isRetired,
    matchesAny,
    readLock,
    resolveGitRef,
    writeLock,
} from "../utils";
import {
    getBotUser,
    listAppEmojis,
    deleteAppEmoji,
    renameAppEmoji,
    uploadAppEmoji,
} from "../discord";
import { DEFAULT_MIME_TYPE, DISCORD_API_BASE_URL, EMOJI_NAME_RULE, EXTENSIONS, LOCK_FILE, RETIRED_PREFIX } from "../../constants";

function guessMime(ext: string): string {
    return EXTENSIONS[ext.toLowerCase()] || DEFAULT_MIME_TYPE;
}

export function registerBuildCommand(app: Command) {
    app.command("build")
        .description("Synchronize emojis and generate indexes")
        .option("--rotate <patterns>", "replace these emojis even if glyph does not know they changed (comma-separated, * wildcard)")
        .option("--since <ref>", "for emojis with no recorded hash yet, replace those whose file differs from this git commit")
        .option("--purge", "delete the old versions kept online after a replacement (old_<id>)")
        .action(async (options: { rotate?: string, since?: string, purge?: boolean }) => {
            const rotate = (options.rotate ?? "").split(",").map(p => p.trim()).filter(Boolean);
            const cfg = loadConfig();

            console.log("━━━ 🧱 glyph build ━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(`📁 Emojis directory : ${cfg.emojisDir}`);
            console.log(`📄 File index       : ${cfg.fileIndex ? "Enabled" : "Disabled"}`);

            /*
             * La cible ne s'affiche que lorsqu'elle n'est pas Discord. L'annoncer
             * a chaque build ajouterait une ligne de bruit ; la, elle repond a la
             * seule question qui compte quand une synchronisation semble ne pas
             * prendre : ou est-ce que ca a ete pousse.
             */
            if (cfg.apiBaseUrl !== DISCORD_API_BASE_URL) {
                console.log(`🌐 API              : ${cfg.apiBaseUrl}`);
            }
            console.log("\n");

            const localNames = await scanLocalEmojis(cfg);

            // Avant la moindre requete : la synchronisation supprime avant d'envoyer, et un nom
            // refuse par Discord au milieu du parcours laisse l'application a moitie faite.
            const invalid = invalidEmojiNames(localNames);

            if (invalid.length > 0) {
                console.error(`❌ ${invalid.length} emoji name(s) Discord will refuse (${EMOJI_NAME_RULE}) :`);

                for (const { name, suggestion } of invalid) {
                    console.error(`    → "${name}" — rename the file to "${suggestion}"`);
                }

                console.error("\nNothing was uploaded or deleted.");
                process.exitCode = 1;
                return;
            }

            if (!cfg.botToken) {
                if (cfg.fileIndex) {
                    console.log("📝 Updating type index file…");

                    const dir = await safeDirAction(cfg);
                    await writeTypesFile(dir, localNames);

                    console.log("    → emojis.d.ts updated ✓\n");
                } else {
                    console.error("❌ Missing bot token. Aborting.");
                }
                return;
            }

            const started = Date.now();
            try {
                const since = options.since ? await resolveGitRef(cfg, options.since) : null;
                const me = await getBotUser(cfg.botToken, cfg.apiBaseUrl);
                const remote = await listAppEmojis(cfg.botToken, me.id, cfg.apiBaseUrl);
                const retired = remote.filter(e => isRetired(e.name));
                const live = remote.filter(e => !isRetired(e.name));
                const remoteNames = live
                    .map(e => e.name)
                    .sort((a, b) => a.localeCompare(b));

                const { toUpload, toDelete, kept } = diffEmojis(localNames, remoteNames);

                const lock = await readLock(cfg, me.id);
                const localFiles = await listLocalEmojiFiles(cfg);
                const filesByName = new Map(localFiles.map(f => [f.name, f]));
                const hashes = new Map(await Promise.all(localFiles.map(async f => [f.name, await hashFile(f.filePath)] as const)));

                /*
                 * Changé depuis le dernier envoi (empreinte différente), ou demandé avec --rotate. Un emoji que
                 * l'état ne connaît pas encore n'est remplacé que si son fichier diffère de celui du commit
                 * --since (le contenu, pas la date) ; sinon il sert de base.
                 */
                const unknownChanged = new Set<string>();
                if (since) {
                    for (const name of kept.filter(n => !lock.emojis[n])) {
                        const before = await fileAtRef(cfg, since, basename(filesByName.get(name)!.filePath));
                        if (before && hashBuffer(before) !== hashes.get(name)) unknownChanged.add(name);
                    }
                }

                const toRotate = kept.filter(name => {
                    const known = lock.emojis[name]?.hash;
                    return matchesAny(name, rotate) || unknownChanged.has(name) || (known !== undefined && known !== hashes.get(name));
                });

                // DELETE
                const remoteByName = new Map(live.map(r => [r.name, r]));
                let deleted = 0, uploaded = 0, rotated = 0, purged = 0, failed = 0;

                for (const name of toDelete) {
                    const r = remoteByName.get(name);
                    if (!r) continue;

                    try {
                        console.log(`🗑  Removing "${name}"…`);

                        await deleteAppEmoji(cfg.botToken, me.id, r.id, cfg.apiBaseUrl);
                        deleted++;

                        console.log("    → Removed ✓");
                    } catch (err: any) {
                        failed++;

                        console.log(`    → Failed ✗ ${err?.message ?? err}`);
                    }
                }

                // ROTATE : l'ancien prend le nom old_<id> et reste valide, le nouveau prend son nom.
                for (const name of toRotate) {
                    const r = remoteByName.get(name);
                    const f = filesByName.get(name);
                    if (!r || !f) continue;

                    console.log(`🔁 Replacing "${name}"…`);
                    try {
                        await renameAppEmoji(cfg.botToken, me.id, r.id, `${RETIRED_PREFIX}${r.id}`, cfg.apiBaseUrl);
                    } catch (err: any) {
                        failed++;
                        console.log(`    → Failed ✗ ${err?.message ?? err}`);
                        continue;
                    }

                    try {
                        const created = await uploadAppEmoji(cfg.botToken, me.id, name, await fileToBase64(f.filePath), guessMime(f.ext), cfg.apiBaseUrl);
                        lock.emojis[name] = { id: created.id, hash: hashes.get(name)! };
                        retired.push({ id: r.id, name: `${RETIRED_PREFIX}${r.id}` });
                        rotated++;
                        console.log(`    → Replaced ✓ (old version kept as ${RETIRED_PREFIX}${r.id})`);
                    } catch (err: any) {
                        failed++;
                        // Sans nouvelle version, l'ancienne reprend son nom : le bot ne perd pas l'emoji.
                        await renameAppEmoji(cfg.botToken, me.id, r.id, name, cfg.apiBaseUrl).catch(() => {});
                        console.log(`    → Failed ✗ ${err?.message ?? err}`);
                    }
                }

                // UPLOAD
                for (const name of toUpload) {
                    const f = filesByName.get(name);
                    if (!f) continue;

                    try {
                        console.log(`📤 Uploading "${name}"…`);

                        const b64 = await fileToBase64(f.filePath);
                        const mime = guessMime(f.ext);

                        const created = await uploadAppEmoji(cfg.botToken, me.id, name, b64, mime, cfg.apiBaseUrl);
                        lock.emojis[name] = { id: created.id, hash: hashes.get(name)! };
                        uploaded++;

                        console.log("    → Uploaded ✓");
                    } catch (err: any) {
                        failed++;

                        console.log(`    → Failed ✗ ${err?.message ?? err}`);
                    }
                }

                // PURGE : seulement sur demande, une fois les messages qui affichaient l'ancienne version passés.
                if (options.purge) {
                    for (const r of retired) {
                        try {
                            console.log(`🧹 Purging "${r.name}"…`);
                            await deleteAppEmoji(cfg.botToken, me.id, r.id, cfg.apiBaseUrl);
                            purged++;
                            console.log("    → Purged ✓");
                        } catch (err: any) {
                            failed++;
                            console.log(`    → Failed ✗ ${err?.message ?? err}`);
                        }
                    }
                }

                // Base de l'état : un emoji gardé sans empreinte connue prend celle du fichier actuel.
                // Un remplacement raté n'est pas une base : --since ou --rotate doit pouvoir le retenter.
                for (const name of kept) {
                    if (!lock.emojis[name] && hashes.has(name) && !toRotate.includes(name)) lock.emojis[name] = { id: remoteByName.get(name)!.id, hash: hashes.get(name)! };
                }
                for (const name of Object.keys(lock.emojis)) {
                    if (!hashes.has(name)) delete lock.emojis[name];
                }
                await writeLock(cfg, lock);

                if (uploaded > 0 || deleted > 0 || rotated > 0 || purged > 0) {
                    console.log("\n");
                }

                // Index generation
                const finalRemote = await listAppEmojis(cfg.botToken, me.id, cfg.apiBaseUrl);

                if (cfg.fileIndex) {
                    console.log("📝 Updating index files…");

                    await writeIndexFiles(finalRemote, cfg);

                    console.log("    → list.json & emojis.d.ts updated ✓\n");
                }

                // SUMMARY
                const dur = ((Date.now() - started) / 1000).toFixed(2);

                console.log("✅ Sync complete");
                console.log(`   ⏱ Duration  : ${dur}s`);
                console.log(`   ↻ Kept      : ${kept.length}`);
                console.log(`   ➕ Uploaded : ${uploaded}`);
                console.log(`   🔁 Replaced : ${rotated}`);
                console.log(`   ➖ Deleted  : ${deleted}`);
                if (options.purge) console.log(`   🧹 Purged   : ${purged}`);
                console.log(`   ✗ Failed    : ${failed}`);
                const waiting = options.purge ? 0 : retired.length;
                if (waiting > 0) console.log(`   ⏳ Old versions kept online : ${waiting} (glyph build --purge to delete them)`);
                console.log(`   🔒 State     : ${LOCK_FILE}`);
                console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

                if (failed > 0) process.exitCode = 1;

            } catch (err: any) {
                console.error("❌ Build failed:", err?.message ?? err);
            }
        });
}
