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

**Manual Configuration:**

You can also manually create a `glyph.config.js` file with your configuration.

The generated `glyph.config.js` file looks like this:

```javascript
import dotenv from "dotenv"
dotenv.config()

const config = {
    emojisDir: "./emojis",       // Folder containing your emojis
    fileIndex: true,             // Automatic index generation
    botToken: process.env.TOKEN  // Your Discord bot token
}

export default config
```

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

**Options:**
- Automatically detects new emojis to upload
- Deletes emojis that are no longer present locally
- Generates `emojis/emojis.d.ts` for TypeScript support
- Generates `emojis/list.json` with all emojis if token is provided

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

This project is licensed under the AGPL v3 License - see the [LICENSE](LICENSE) file for details.

> We chose the AGPL to ensure that Glyph remains truly open source and contributive.
If you use or adapt Glyph, even over a network, you must share your modifications. That's the spirit of the project — building useful tools together, in the open.