import { readFileSync } from "fs";
import { resolve } from "path";
import { GlyphEntry } from "../types";
import type { Emojis, EmojisRecord } from "glyph/emojis";

export type GlyphInitOptions = Partial<{ emojisDir: string }>;
export class Glyph {
	private static instance: Glyph;
	private byName = new Map<string, GlyphEntry>();

	static async init(options: GlyphInitOptions = { emojisDir: "./emojis" }) {
		if (Glyph.instance) throw new Error("Glyph already Initialized");

		if (!options.emojisDir) options.emojisDir = "./emojis";

		const dir = options?.emojisDir;
		const list = JSON.parse(
			readFileSync(resolve(dir, "list.json"), "utf-8")
		) as GlyphEntry[];

		const g = new Glyph();
		for (const e of list) g.byName.set(e.name, e);

		Glyph.instance = g;
	}

	private static ensure(): Glyph {
		if (!Glyph.instance) throw new Error("Glyph not initialized");
		return Glyph.instance;
	}

	static get(name: Emojis): GlyphEntry | undefined {
		return Glyph.ensure().byName.get(name);
	}

	static size(): number {
		return Glyph.ensure().byName.size;
	}
	static list(): GlyphEntry[] {
		return [...Glyph.ensure().byName.values()];
	}
	static has(name: Emojis): boolean {
		return Glyph.ensure().byName.has(name);
	}
	static identifier(name: Emojis): string | undefined {
		return Glyph.ensure().byName.get(name)?.identifier;
	}
}
