/**
 * This file is part of Glyph (https://github.com/FCAgreatgoals/glyph).
 *
 * Copyright (C) 2026 SAS French Community Agency
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * Additional permission under the AGPL-3.0 section 7:
 * You may use this library as a dependency in your own application without
 * your application being subject to the AGPL-3.0. Only modifications to
 * Glyph itself must be made publicly available. See LINKING_EXCEPTION.md
 * for full details.
 */

import { Command } from 'commander'
import prompts from 'prompts'
import fs from 'fs'
import path from 'path'

import { loadConfig } from '../GlyphConfig'
import { CONFIG_FILE, GITIGNORE_ENTRY, LOCK_GITIGNORE_ENTRY, TYPES_FILE } from '../../constants'

export function registerSetupCommand(app: Command) {
    app.command("setup")
        .description("Setup default config for glyph")
        .action(async () => {
            const config = loadConfig()

            console.log('━━━ 🛠️ glyph setup ━━━━━━━━━━━━━━━━━━━━━━━')

            // Create emoji directory (always)
            const absEmojiDir = path.join(process.cwd(), config.emojisDir)

            if (!fs.existsSync(absEmojiDir)) {
                fs.mkdirSync(absEmojiDir, { recursive: true })
                console.log(`📁 Created emoji directory at ${config.emojisDir}\n`)
            } else {
                console.log(`📁 Emoji directory already exists at ${config.emojisDir}\n`)
            }

            // Update .gitignore (always)
            const gitignorePath = path.join(process.cwd(), '.gitignore')

            if (fs.existsSync(gitignorePath)) {
                const lines = fs.readFileSync(gitignorePath, 'utf8')
                    .split(/\r?\n/)
                    .map(line => line.trim())
                const missing = [GITIGNORE_ENTRY, LOCK_GITIGNORE_ENTRY].filter(entry => !lines.includes(entry))

                if (missing.length > 0) {
                    fs.appendFileSync(gitignorePath, `\n#glyph\n${missing.join('\n')}\n`)
                    for (const entry of missing) console.log(`📝 Added "${entry}" to .gitignore`)
                    console.log()
                } else {
                    console.log(`📝 Glyph files already in .gitignore\n`)
                }
            }

            // Update tsconfig.json (always)
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')

            if (fs.existsSync(tsconfigPath)) {
                const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8')
                const tsconfig = JSON.parse(tsconfigContent)

                if (!tsconfig.include) tsconfig.include = []

                const emojiDtsPath = `emojis/${TYPES_FILE}`

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
                    message: 'Do you want to create a configuration file? (If no, environment variables TOKEN, EMOJIS_DIR and DISCORD_API will be used)',
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
\tbotToken: process.env.TOKEN,

\t// Where emojis are pushed. Unset, glyph talks to Discord; point it at a REST
\t// proxy or a simulator to go through those instead.
\tapiBaseUrl: process.env.DISCORD_API
}

export default config
`

                fs.writeFileSync(configPath, configContent)
                console.log(`⭐ Created ${CONFIG_FILE}\n`)
            } else {
                console.log('🔧 Using environment variables (TOKEN, EMOJIS_DIR and DISCORD_API)\n')
            }

            console.log('✅ Setup complete.')
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        })
}
