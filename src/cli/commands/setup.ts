/**
 * This file is part of glyph (https://github.com/FCAgreatgoals/glyph.git).
 *
 * Copyright (C) 2025 SAS French Community Agency
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
 */

import fs from 'fs'
import path from 'path'
import prompts from 'prompts'
import { loadConfig } from '../GlyphConfig'
import { Command } from 'commander'
import { CONFIG_FILE, GITIGNORE_ENTRY, TYPES_FILE } from '../../constants'

export function registerSetupCommand(app: Command) {
    app.command("setup")
        .description("Setup default config for glyph")
        .action(async () => {
            const config = await loadConfig()

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
