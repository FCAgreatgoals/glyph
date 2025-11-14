import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import { CONFIG_FILE, DEFAULT_CONFIG } from '../GlyphConfig'
import { Command } from 'commander'

const GITIGNORE_ENTRY = 'emojis/list.json'

export function runSetup(app: Command) {
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

            // Create emoji directory
            const emojisDir = DEFAULT_CONFIG.emojisDir
            const absEmojiDir = path.join(process.cwd(), emojisDir)

            if (!fs.existsSync(absEmojiDir)) {
                fs.mkdirSync(absEmojiDir, { recursive: true })
                console.log(`Created emoji directory at ${emojisDir}`)
            }

            // Write glyph.config.js
            const configContent =
`import dotenv from "dotenv"
dotenv.config()

const config = {
\temojisDir: "./emojis",
\tfileIndex: true,
\tbotToken: process.env.TOKEN
}

export default config
`

            fs.writeFileSync(configPath, configContent)
            console.log(`Created default ${CONFIG_FILE}`)

            // Update .gitignore
            const gitignorePath = path.join(process.cwd(), '.gitignore')

            if (fs.existsSync(gitignorePath)) {
                const content = fs.readFileSync(gitignorePath, 'utf8')
                const alreadyIgnored = content
                    .split(/\r?\n/)
                    .some(line => line.trim() === GITIGNORE_ENTRY)

                if (!alreadyIgnored) {
                    fs.appendFileSync(gitignorePath, `\n#glyph\n${GITIGNORE_ENTRY}\n`)
                    console.log(`Added "${GITIGNORE_ENTRY}" to .gitignore`)
                }
            }

            console.log('Setup complete.')
        })
}
