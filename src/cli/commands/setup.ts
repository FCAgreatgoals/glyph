import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import { DEFAULT_CONFIG } from '../GlyphConfig'
import { Command } from 'commander'

const CONFIG_FILE = 'glyph.config.js'

export async function runSetup(app: Command) {
    app.command("setup")
		.description("Setup default config for glyph")
		.action(async () => {
			const configPath = path.join(process.cwd(), CONFIG_FILE)
            const configExists = fs.existsSync(configPath)

            if (configExists) {
                const response = await prompts({
                    type: 'confirm',
                    name: 'reset',
                    message: 'A configuration already exists. Do you want to reset it?'
                })

                if (!response.reset) {
                    console.log('Setup cancelled.')
                    return
                }
            }

            // Create the default emoji directory
            const emojisDir = DEFAULT_CONFIG.emojisDir
            const absEmojiDir = path.join(process.cwd(), emojisDir)

            if (!fs.existsSync(absEmojiDir)) {
                fs.mkdirSync(absEmojiDir, { recursive: true })
                console.log(`Created emoji directory at ${emojisDir}`)
            }

            // Write the default glyph.config.js
            const configContent = `import dotenv from "dotenv"\ndotenv.config()\n\nconst config = {\n\temojisDir: "./emojis",\n\tfileIndex: true,\n\tbotToken: process.env.TOKEN\n}\n\nexport default config`

            fs.writeFileSync(configPath, configContent)
            console.log(`Created default ${CONFIG_FILE}`)

            console.log('Setup complete.')
		});
}
