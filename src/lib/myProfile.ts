/**
 * Eigenes Spielerprofil dieses Geräts (localStorage, bleibt über Sessions).
 * Name + Avatar werden beim Beitreten in einen Raum automatisch übernommen.
 */
import { AVATAR_COLORS, type Avatar } from '@quizapp/shared'
import { readRoomIdentity, saveRoomIdentity } from './roomIdentity'

const STORAGE_KEY = 'quizapp:myProfile'

export interface MyProfile {
  name: string
  avatar: Avatar
}

/** Kuratierte Emoji-Auswahl für den Avatar-Editor. */
export const AVATAR_EMOJIS: readonly string[] = [
  '🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐧', '🦉', '🐳',
  '🚀', '🎸', '🎲', '🧠', '⚡', '🔥', '🌵', '🍕', '👑', '🤖',
]

export function readMyProfile(): MyProfile {
  const fallbackName = readRoomIdentity().playerName ?? ''
  const fallback: MyProfile = {
    name: fallbackName,
    avatar: { colorHex: AVATAR_COLORS[0], photoDataUrl: null, emoji: null, title: null },
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<MyProfile>
    return {
      name: typeof parsed.name === 'string' ? parsed.name : fallbackName,
      avatar: { ...fallback.avatar, ...(parsed.avatar ?? {}) },
    }
  } catch {
    return fallback
  }
}

export function saveMyProfile(profile: MyProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    if (profile.name.trim()) saveRoomIdentity({ playerName: profile.name.trim() })
  } catch {
    // Silent.
  }
}

/**
 * Avatar für den Raum: ohne Foto, weil der komplette Spielstand bei jeder
 * Aktion an alle Geräte geht (WebSocket-Frames sind auf 128 KB begrenzt).
 */
export function roomAvatar(profile: MyProfile, title: string | null): Avatar {
  return {
    colorHex: profile.avatar.colorHex,
    photoDataUrl: null,
    emoji: profile.avatar.emoji ?? null,
    title,
  }
}
