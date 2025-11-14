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

import { Command } from "commander";
import { loadConfig } from "../GlyphConfig";
import {
	scanLocalEmojis,
	listLocalEmojiFiles,
	diffEmojis,
	writeIndexFiles,
	fileToBase64,
} from "../utils";
import {
	getBotUser,
	listAppEmojis,
	deleteAppEmoji,
	uploadAppEmoji,
} from "../discord";

function guessMime(ext: string): string {
	switch (ext.toLowerCase()) {
		case ".gif":
			return "image/gif";
		case ".jpg":
			return "image/jpg";
		case ".jpeg":
			return "image/jpeg";
		case ".apng":
			return "image/apng";
		default:
			return "image/png";
	}
}

export function runBuild(app: Command) {
	app.command("build")
		.description("Synchronize emojis and generate indexes")
		.action(async () => {
			const cfg = await loadConfig();

			console.log("━━━ 🧱 glyph build ━━━━━━━━━━━━━━━━━━━━━━━");
			console.log(`📁 Emojis directory : ${cfg.emojisDir}`);
			console.log(`📄 File index       : ${cfg.fileIndex ? "Enabled" : "Disabled"}`);
			console.log("\n");

			if (!cfg.botToken) {
				console.error("❌ Missing bot token. Aborting.");
				return;
			}

			const localNames = await scanLocalEmojis(cfg);

			const started = Date.now();
			try {
				const me = await getBotUser(cfg.botToken);
				const remote = await listAppEmojis(cfg.botToken, me.id);
				const remoteNames = remote
					.map(e => e.name)
					.sort((a, b) => a.localeCompare(b));

				const { toUpload, toDelete, kept } = diffEmojis(localNames, remoteNames);

				// DELETE
				const remoteByName = new Map(remote.map(r => [r.name, r]));
				let deleted = 0, uploaded = 0, failed = 0;

				for (const name of toDelete) {
					const r = remoteByName.get(name);
					if (!r) continue;
					try {
						console.log(`🗑  Removing "${name}"…`);
						await deleteAppEmoji(cfg.botToken, me.id, r.id);
						console.log("    → Removed ✓");
						deleted++;
					} catch (err: any) {
						console.log(`    → Failed ✗ ${err?.message ?? err}`);
						failed++;
					}
				}

				// UPLOAD
				const localFiles = await listLocalEmojiFiles(cfg);
				const filesByName = new Map(localFiles.map(f => [f.name, f]));

				for (const name of toUpload) {
					const f = filesByName.get(name);
					if (!f) continue;
					try {
						console.log(`📤 Uploading "${name}"…`);
						const b64 = await fileToBase64(f.filePath);
						const mime = guessMime(f.ext);

						await uploadAppEmoji(cfg.botToken, me.id, name, b64, mime);
						console.log("    → Uploaded ✓");
						uploaded++;
					} catch (err: any) {
						console.log(`    → Failed ✗ ${err?.message ?? err}`);
						failed++;
					}
				}

				if (uploaded > 0 || deleted > 0) {
					console.log("\n");
				}

				// Index generation
				const finalRemote = await listAppEmojis(cfg.botToken, me.id);
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
				console.log(`   ➖ Deleted  : ${deleted}`);
				console.log(`   ✗ Failed    : ${failed}`);
				console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

				if (failed > 0) process.exitCode = 1;

			} catch (err: any) {
				console.error("❌ Build failed:", err?.message ?? err);
			}
		});
}
