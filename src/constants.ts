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

// Configuration files
export const CONFIG_FILE = 'glyph.config.js'
export const GITIGNORE_ENTRY = 'emojis/list.json'

// Default directories and paths
export const DEFAULT_EMOJIS_DIR = './emojis'
export const LIST_FILE = 'list.json'
export const TYPES_FILE = 'emojis.d.ts'

// Discord API
export const DISCORD_API_BASE_URL = 'https://discord.com/api/v10'
export const DISCORD_API_USERS_ME = `${DISCORD_API_BASE_URL}/users/@me`
export const DISCORD_API_APP_EMOJIS = (appId: string) => `${DISCORD_API_BASE_URL}/applications/${appId}/emojis`
export const DISCORD_API_APP_EMOJI = (appId: string, emojiId: string) => `${DISCORD_API_BASE_URL}/applications/${appId}/emojis/${emojiId}`

export const EXTENSIONS: Record<string, string> = {
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.apng': 'image/apng',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
}

export const DEFAULT_MIME_TYPE = EXTENSIONS['.png']