declare module "glyph/emojis" {
  export type Emojis = string;
  export type EmojisRecord = Record<
    string,
    { id: string; name: string; identifier: string }
  >;
}