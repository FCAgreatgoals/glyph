import { readFileSync } from "fs";
import { resolve } from "path";
import { GlyphEntry } from "../types";
import type { Emojis } from "glyph/emojis";
import { LIST_FILE } from "../constants";
import { loadConfig } from "../cli/GlyphConfig";

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

    public static identifier(name: Emojis): string {
        const entry = this.get(name);

        return `<${entry.animated ? "a" : ""}:${entry.name}:${entry.id}>`;
    }

    public static id(name: Emojis): string {
        return this.get(name).id;
    }
}
