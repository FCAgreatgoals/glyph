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

			console.log("glyph build");
			console.log("emojisDir:", cfg.emojisDir);
			console.log("fileIndex:", cfg.fileIndex);
			console.log("botToken:", cfg.botToken ? "(loaded)" : "(missing)");

			const localNames = await scanLocalEmojis(cfg);
			console.log(
				`local: ${localNames.length}${localNames.length ? " → " + localNames.join(", ") : ""}`
			);

			if (!cfg.botToken) {
				console.error("❌ Missing bot token. Aborting.");
				return;
			}

			const started = Date.now();
			try {
				const me = await getBotUser(cfg.botToken);
				const remote = await listAppEmojis(cfg.botToken, me.id);
				const remoteNames = remote
					.map((e) => e.name)
					.sort((a, b) => a.localeCompare(b));

				const { toUpload, toDelete, kept } = diffEmojis(
					localNames,
					remoteNames
				);

				console.log(
					`remote: ${remoteNames.length}${remoteNames.length ? " → " + remoteNames.join(", ") : ""}`
				);
				console.log("plan:");
				console.log(
					"  toUpload:",
					toUpload.length,
					toUpload.join(", ") || "(none)"
				);
				console.log(
					"  toDelete:",
					toDelete.length,
					toDelete.join(", ") || "(none)"
				);
				console.log("  kept   :", kept.length);

				// DELETE
				const remoteByName = new Map(remote.map((r) => [r.name, r]));
				let deleted = 0,
					uploaded = 0,
					failed = 0;

				for (const name of toDelete) {
					const r = remoteByName.get(name);
					if (!r) continue;
					try {
						console.log(`🗑 DELETE ${name} … `);
						await deleteAppEmoji(cfg.botToken, me.id, r.id);
						console.log("✅");
						deleted++;
					} catch (err: any) {
						console.log(`❌ ${err?.message ?? err}`);
						failed++;
					}
				}

				// UPLOAD
				const localFiles = await listLocalEmojiFiles(cfg);
				const filesByName = new Map(localFiles.map((f) => [f.name, f]));

				for (const name of toUpload) {
					const f = filesByName.get(name);
					if (!f) continue;
					try {
						console.log(`📤 UPLOAD ${name} … `);
						const b64 = await fileToBase64(f.filePath);
						const mime = guessMime(f.ext);

						await uploadAppEmoji(cfg.botToken, me.id, name, b64,mime);
						console.log("✅");
						uploaded++;
					} catch (err: any) {
						console.log(`❌ ${err?.message ?? err}`);
						failed++;
					}
				}

				// Final fetch + index generation
				const finalRemote = await listAppEmojis(cfg.botToken, me.id);
				if (cfg.fileIndex) {
					await writeIndexFiles(finalRemote, cfg);
					console.log("📝 wrote list.json & emojis.d.ts");
				}

				const dur = ((Date.now() - started) / 1000).toFixed(2);
				console.log(
					`Done in ${dur}s — kept:${kept.length}, uploaded:${uploaded}, deleted:${deleted}, failed:${failed}`
				);
				if (failed > 0) process.exitCode = 1;
			} catch (err: any) {
				console.error("❌ build failed:", err?.message ?? err);
			}
		});
}
