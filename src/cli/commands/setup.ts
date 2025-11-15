import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import { CONFIG_FILE, loadConfig } from '../GlyphConfig'
import { Command } from 'commander'

const GITIGNORE_ENTRY = 'emojis/list.json'

export function runSetup(app: Command) {
    app.command("setup")
        .description("Setup default config for glyph")
        .action(async () => {
            // Create emoji directory (always)

            const config = await loadConfig()
            const absEmojiDir = path.join(process.cwd(), config.emojisDir)

            console.log('━━━ 🛠️ glyph setup ━━━━━━━━━━━━━━━━━━━━━━━')

            if (!fs.existsSync(absEmojiDir)) {
                fs.mkdirSync(absEmojiDir, { recursive: true })
                console.log(`📁 Created emoji directory at ${config.emojisDir}\n`)
            } else {
                console.log(`📁 Emoji directory already exists at ${config.emojisDir}\n`)
            }

            // Update .gitignore (always)
            const gitignorePath = path.join(process.cwd(), '.gitignore')

            if (fs.existsSync(gitignorePath)) {
                const content = fs.readFileSync(gitignorePath, 'utf8')
                const alreadyIgnored = content
                    .split(/\r?\n/)
                    .some(line => line.trim() === GITIGNORE_ENTRY)

                if (!alreadyIgnored) {
                    fs.appendFileSync(gitignorePath, `\n#glyph\n${GITIGNORE_ENTRY}\n`)
                    console.log(`📝 Added "${GITIGNORE_ENTRY}" to .gitignore\n`)
                } else {
                    console.log(`📝 "${GITIGNORE_ENTRY}" already in .gitignore\n`)
                }
            }

            // Update tsconfig.json (always)
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')

            if (fs.existsSync(tsconfigPath)) {
                const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8')
                const tsconfig = JSON.parse(tsconfigContent)

                if (!tsconfig.include) tsconfig.include = []

                const emojiDtsPath = 'emojis/emojis.d.ts'

                if (!tsconfig.include.includes(emojiDtsPath)) {
                    tsconfig.include.push(emojiDtsPath)
                    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 4))
                    console.log(`⚙️  Added "${emojiDtsPath}" to tsconfig.json include\n`)
                } else {
                    console.log(`⚙️  "${emojiDtsPath}" already in tsconfig.json\n`)
                }
            }

            // Ask if user wants to create a config file or use environment variables
            const configPath = path.join(process.cwd(), CONFIG_FILE)
            const configExists = fs.existsSync(configPath)

            let createConfig = false

            if (configExists) {
                const response = await prompts({
                    type: 'confirm',
                    name: 'reset',
                    message: 'A configuration file already exists. Do you want to reset it?'
                })

                createConfig = response.reset
            } else {
                const response = await prompts({
                    type: 'confirm',
                    name: 'createConfig',
                    message: 'Do you want to create a configuration file? (If no, environment variables TOKEN and EMOJIS_DIR will be used)',
                    initial: false
                })

                createConfig = response.createConfig
            }

            if (createConfig) {
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
                console.log(`⭐ Created ${CONFIG_FILE}\n`)
            } else {
                console.log('🔧 Using environment variables (TOKEN and EMOJIS_DIR)\n')
            }

            console.log('✅ Setup complete.')
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        })
}
