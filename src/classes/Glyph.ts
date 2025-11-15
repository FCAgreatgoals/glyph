import { readFileSync } from "fs";
import { resolve } from "path";
import { GlyphEntry } from "../types";
import type { Emojis } from "glyph/emojis";
import { DEFAULT_EMOJIS_DIR, LIST_FILE } from "../constants";

export type GlyphInitOptions = Partial<{ emojisDir: string }>;
export class Glyph {
	private static instance: Glyph;
	private entries: Map<string, GlyphEntry>

	constructor(list: Array<GlyphEntry>) {
		this.entries = new Map(list.map((e: any) => [e.name, e]));
	}

	static init(options: GlyphInitOptions = {
		emojisDir: DEFAULT_EMOJIS_DIR
	}) {
		if (Glyph.instance) throw new Error("Glyph already Initialized");

		if (!options.emojisDir)
			options.emojisDir = DEFAULT_EMOJIS_DIR;

		const dir = options?.emojisDir;

		const list = JSON.parse(
			readFileSync(resolve(dir, LIST_FILE), "utf-8")
		) as Array<GlyphEntry>;

		Glyph.instance = new Glyph(list);
	}

	private static ensure(): Glyph {
		if (!Glyph.instance) throw new Error("Glyph not initialized");
		return Glyph.instance;
	}

	static get(name: Emojis): GlyphEntry | undefined {
		return Glyph.ensure().entries.get(name);
	}

	static size(): number {
		return Glyph.ensure().entries.size;
	}

	static list(): Array<GlyphEntry> {
		return [...Glyph.ensure().entries.values()];
	}

	static has(name: Emojis): boolean {
		return Glyph.ensure().entries.has(name);
	}

	static identifier(name: Emojis): string | undefined {
		return Glyph.ensure().entries.get(name)?.identifier;
	}
}
