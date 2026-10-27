# Glyph

**Glyph** is an application emoji manager for Discord Bots, designed to simplify the synchronization and usage of custom emojis in your Discord projects.

## Installation

```bash
pnpm install @fca.gg/glyph
```

## 🚀 Quick Start

### 1. Initial Setup

Initialize Glyph in your project:

```bash
pnpm glyph setup
```

This command will:
- Create the `emojis/` folder for your emoji files
- (Optional) Generate a `glyph.config.js` file with the default configuration
- Add `emojis/list.json` to `.gitignore`
- Add `emojis/emojis.d.ts` to `tsconfig.json`

### 2. Configuration

**Default Environment Variables:**

By default, the application will use the following environment variables if not explicitly configured:
- `TOKEN` - for the Discord bot token
- `EMOJIS_DIR` - for the emojis directory path
- `DISCORD_API` - for the API root (defaults to `https://discord.com/api/v10`)

**Manual Configuration:**

You can also manually create a `glyph.config.js` file with your configuration.

The generated `glyph.config.js` file looks like this:

```javascript
import dotenv from "dotenv"
dotenv.config()

const config = {
    emojisDir: "./emojis",            // Folder containing your emojis
    fileIndex: true,                  // Automatic index generation
    botToken: process.env.TOKEN,      // Your Discord bot token
    apiBaseUrl: process.env.DISCORD_API // API root (unset: Discord)
}

export default config
```

**Pointing glyph somewhere else:**

`apiBaseUrl` decides where emojis are pushed. Two reasons to change it:

- **A REST proxy.** Many setups route every Discord call through one, to share
  rate-limit budgets across processes or to observe the traffic. Glyph should go
  the same way as the rest of the application rather than around it.
- **A simulator.** Pushing against a fake Discord during tests avoids touching
  the real application's emojis, which every server the bot is on can see.

Like every other setting, it comes either from the config file or, when there is
no config file, from the environment. A config file is JavaScript, so it routes
the variable itself if you want it to:

```javascript
apiBaseUrl: process.env.DISCORD_API   // unset: Discord
```

A setting left `undefined` falls back to its default rather than erasing it, so
an unset variable means Discord, not a broken URL.

```bash
DISCORD_API=http://localhost:7070/api/v10 pnpm glyph build
```

When the root is not Discord, `glyph build` prints it. Pushing to a proxy
without realising it is the kind of accident one visible line prevents.

**Important:** Make sure you have your Discord token defined in your `.env` file:

```env
TOKEN=your_discord_bot_token
```

### 3. Adding Emojis

Place your emoji files (PNG, GIF, JPEG, APNG, WebP, AVIF) in the `emojis/` folder:

```
emojis/
├── happy.png
├── sad.png
├── party.gif
└── thinking.png
```

**Note:** The filename (without extension) will be used as the emoji name on Discord.

Discord only accepts **2 to 32 characters, letters, digits and underscores**. A file named
`flag-fr.png` is refused. `glyph build` checks every name before contacting Discord and stops with
the offending files and the name to use instead, rather than failing halfway through a sync:

```
❌ 1 emoji name(s) Discord will refuse (2 to 32 characters, letters, digits and underscores only) :
    → "flag-fr" — rename the file to "flag_fr"

Nothing was uploaded or deleted.
```

### 4. Synchronization

Synchronize your emojis with Discord:

```bash
pnpm glyph build
```

This command will:
- Scan the `emojis/` folder
- Compare with existing emojis on Discord
- Upload new emojis
- Delete emojis that are no longer present locally
- Generate index files (`list.json` and `emojis.d.ts`)

## 💻 Usage in Your Code

### Initialization

```typescript
import Glyph from "@fca.gg/glyph"

// Initialize Glyph when starting your bot
Glyph.init()
```

### Retrieving Emojis

```typescript
// Get a specific emoji
const emoji = Glyph.get("happy")
console.log(emoji)
// { id: "794367836033515531", name: "happy", identifier: "<:happy:794367836033515531>" }

// Get only the identifier (Discord format)
const identifier = Glyph.identifier("happy")
console.log(identifier) // "<:happy:794367836033515531>"

// Check if an emoji exists
if (Glyph.has("party")) {
    console.log("The party emoji exists!")
}

// Get the complete list of emojis
const allEmojis = Glyph.list()
console.log(`Number of emojis: ${Glyph.size()}`)
```

### Usage with Discord.js

```typescript
import { Client, GatewayIntentBits } from "discord.js"
import Glyph from "@fca.gg/glyph"

Glyph.init()

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
})

client.once("ready", () => {
    console.log("Bot ready!")
})

client.on("messageCreate", async (message) => {
    if (message.content === "!emoji") {
        const happy = Glyph.identifier("happy")
        await message.reply(`Here's an emoji: ${happy}`)
    }
})

client.login(process.env.TOKEN)
```

### TypeScript - Autocomplete

Glyph automatically generates TypeScript types for your emojis:

```typescript
import type { Emojis } from "glyph/emojis"

// 'Emojis' will be a union type of all your emoji names
// For example: "happy" | "sad" | "party" | "thinking"

function sendEmoji(name: Emojis) {
    return Glyph.identifier(name)  // Autocomplete available!
}
```

## 📋 CLI Commands

### `glyph setup`
Initializes Glyph configuration in your project.

### `glyph build`
Synchronizes local emojis with Discord and generates index files.

**Behavior:**
- Automatically detects new emojis to upload
- Deletes emojis that are no longer present locally
- Replaces emojis whose image changed (see below)
- Generates `emojis/emojis.d.ts` for TypeScript support
- Generates `emojis/list.json` with all emojis if token is provided

**Options:**
- `--rotate <patterns>`: replace these emojis even if Glyph has no record of their previous image (comma-separated names, `*` wildcard), e.g. `--rotate 'iconLog*,iconSanctions*'`
- `--since <ref>`: for emojis with no recorded hash yet, replace those whose file differs from this git commit, e.g. `--since v1.4.0`
- `--purge`: delete the old versions kept online after a replacement

#### Replacing an emoji

Discord cannot change the image of an existing emoji. When a file changes, `glyph build` renames
the emoji online to `old_<id>` and uploads the new image under the original name, with a new id.
The old version stays valid, so messages already sent keep showing it while your bot restarts
with the new `list.json`. `old_*` emojis are never deleted automatically and never appear in the
index: run `glyph build --purge` once every instance uses the new ids.

Glyph knows an image changed through `emojis/glyph.lock.json`, which records, per application, the
id and the SHA-256 of the file last sent to Discord (Discord re-encodes images, so they cannot be
compared to what it serves). Keep it out of git like `list.json`: each environment (bot) has its
own. An emoji with no entry yet (first versioned build, new environment) is recorded as is. To
replace the ones whose image changed in the meantime, pass the last commit that environment was
built from: `--since <ref>` compares each file's content with that commit (dates are not reliable:
emojis are usually uploaded before their file is committed). `--rotate` replaces emojis regardless.

## 🎯 Supported Formats

Glyph supports the following image formats:
- PNG (`.png`)
- Animated GIF (`.gif`)
- JPEG (`.jpg`, `.jpeg`)
- APNG (`.apng`)
- WebP (`.webp`)
- AVIF (`.avif`)

## 📝 Generated File Structure

### `emojis/list.json`
```json
[
  {
    "id": "794367836033515531",
    "name": "happy",
    "animated": false
  },
  {
    "id": "917871943041048636",
    "name": "party",
    "animated": true
  }
]
```

### `emojis/emojis.d.ts`
```typescript
declare module "glyph/emojis" {
  export type Emojis = 'happy' | 'party' | 'sad' | 'thinking';
  export type EmojisRecord = Record<Emojis, { 
    id: string; 
    name: string; 
    animated: boolean 
  }>;
}
```

## 🛠️ Recommended Workflow

1. **Development:**
   ```bash
   # Add your emojis to emojis/
   pnpm glyph build
   ```

2. **Production:**
   ```bash
   # In your CI/CD or during deployment
   pnpm glyph build
   ```

3. **Versioning:**
   - Commit your emoji files (`.png`, `.gif`, etc.)
   - Remember that `emojis/list.json` is in `.gitignore`
   - Regenerate the index after each clone with `pnpm glyph build`

## License

This project is licensed under the **AGPL-3.0** with a Linking Exception — see the [LICENSE](LICENSE) file for the full license text.

> We chose the AGPL to ensure that Glyph remains truly open source and contributive.
> If you fork or modify Glyph itself — even to run it over a network — you must share your modifications. That's the spirit of the project: building useful tools together, in the open.

### Linking Exception

If you simply use Glyph as a dependency in your own project (e.g. `npm install @fca.gg/glyph`), your application is **not** required to be open source. Only modifications to Glyph itself are subject to the AGPL.

See [LINKING_EXCEPTION.md](LINKING_EXCEPTION.md) for the full exception text.