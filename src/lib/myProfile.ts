/**
 * Eigenes Spielerprofil dieses Geräts (localStorage, bleibt über Sessions).
 * Name + Avatar werden beim Beitreten in einen Raum automatisch übernommen.
 */
import { AVATAR_COLORS, randomAvatarLook, sanitizeAvatarLook, type Avatar, type AvatarLook } from '@quizapp/shared'
import { readRoomIdentity, saveRoomIdentity } from './roomIdentity'

const STORAGE_KEY = 'quizapp:myProfile'

export interface MyProfile {
  name: string
  avatar: Avatar
  /** Zuletzt gebaute Figur — bleibt erhalten, wenn man kurz auf Emoji wechselt. */
  figure?: AvatarLook | null
}

/** Kuratierte Emoji-Auswahl für den Avatar-Editor. */
export const AVATAR_EMOJIS: readonly string[] = [
  '🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐧', '🦉', '🐳',
  '🚀', '🎸', '🎲', '🧠', '⚡', '🔥', '🌵', '🍕', '👑', '🤖',
]

export function readMyProfile(): MyProfile {
  const fallbackName = readRoomIdentity().playerName ?? ''
  // Neue Geräte starten mit einer zufälligen Figur, damit der Baukasten sichtbar ist.
  const look = randomAvatarLook()
  const fallback: MyProfile = {
    name: fallbackName,
    avatar: { colorHex: AVATAR_COLORS[0], photoDataUrl: null, emoji: null, title: null, look },
    figure: look,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<MyProfile>
    const avatar = { ...fallback.avatar, look: null, ...(parsed.avatar ?? {}) }
    avatar.look = sanitizeAvatarLook(avatar.look)
    // Profile von vor dem Avatar-Baukasten (kein `figure`-Feld) starten einmalig mit
    // Figur statt Emoji/Initialen. Wer danach bewusst Emoji wählt, behält das.
    if (!('figure' in parsed) && !avatar.look) {
      avatar.look = look
      avatar.emoji = null
    }
    return {
      name: typeof parsed.name === 'string' ? parsed.name : fallbackName,
      avatar,
      figure: sanitizeAvatarLook(parsed.figure) ?? avatar.look,
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
    look: profile.avatar.look ?? null,
  }
}
