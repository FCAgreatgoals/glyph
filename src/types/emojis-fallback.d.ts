declare module "glyph/emojis" {
  export type Emojis = string;
  export type EmojisRecord = Record<
    Emojis,
    { id: string; name: Emojis; identifier: string }
  >;
}