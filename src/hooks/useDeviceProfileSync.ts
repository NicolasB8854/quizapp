/**
 * Verbindet den Raum mit dem Geräte-Profil (#2, #22):
 *  1. Eigener Avatar (Farbe, Emoji, Titel) wird beim Beitreten übernommen.
 *  2. Eigene Antworten (Spotlight, Fachrunde, Elimination) zählen in die Themen-Statistik.
 *  3. Abgeschlossene Spieleabende zählen als gespielt/gewonnen.
 */
import { useEffect, useRef } from 'react'
import { sameAvatarLook, type GameAction, type GameState, type Player, type Topic } from '@quizapp/shared'
import { findMatchWinner } from '@/components/WinnerHero'
import { readMyProfile, roomAvatar } from '@/lib/myProfile'
import { readSoloStats, saveNight, saveNightAnswers } from '@/lib/soloStats'
import { primaryTitle } from '@/lib/titles'

/** Eigene, gerade aufgelöste Antwort aus dem Live-State — oder null. */
export function extractMyAnswer(
  state: GameState,
  myPlayerId: string,
): { key: string; topic: Topic; correct: boolean } | null {
  const live = state.live
  if (!live) return null
  if ((live.kind === 'player-spotlight' || live.kind === 'experts') && live.activePlayerId === myPlayerId) {
    const q = live.activeQuestion
    if (!q || live.primaryOutcome === null) return null
    return { key: `${live.kind}:${q.id}`, topic: q.topic, correct: live.primaryOutcome === 'correct' }
  }
  if (live.kind === 'elimination' && live.activePlayerId === myPlayerId && live.phase === 'revealed') {
    const q = live.activeQuestion
    if (!q || live.lastOutcome === null) return null
    return { key: `elimination:${q.id}`, topic: q.topic, correct: live.lastOutcome === 'correct' }
  }
  return null
}

export function useDeviceProfileSync({
  state,
  myPlayer,
  roomCode,
  canDispatch,
  send,
}: {
  state: GameState | null
  myPlayer: Player | null
  roomCode: string
  canDispatch: boolean
  send: (a: GameAction) => void
}) {
  const avatarSentRef = useRef<string | null>(null)
  const countedAnswersRef = useRef<Set<string>>(new Set())

  // 1. Avatar übernehmen (einmal pro Spieler-ID, und nur wenn er abweicht).
  useEffect(() => {
    if (!myPlayer || !canDispatch || avatarSentRef.current === myPlayer.id) return
    const desired = roomAvatar(readMyProfile(), primaryTitle(readSoloStats()))
    const cur = myPlayer.avatar
    avatarSentRef.current = myPlayer.id
    if (
      cur.colorHex === desired.colorHex &&
      (cur.emoji ?? null) === desired.emoji &&
      (cur.title ?? null) === desired.title &&
      sameAvatarLook(cur.look, desired.look)
    ) {
      return
    }
    send({ type: 'SET_PLAYER_AVATAR', playerId: myPlayer.id, avatar: desired })
  }, [myPlayer, canDispatch, send])

  // 2. Eigene Antworten zählen.
  useEffect(() => {
    if (!state || !myPlayer) return
    const mine = extractMyAnswer(state, myPlayer.id)
    if (!mine || countedAnswersRef.current.has(mine.key)) return
    countedAnswersRef.current.add(mine.key)
    saveNightAnswers([{ topic: mine.topic, correct: mine.correct }])
  }, [state, myPlayer])

  // 3. Spieleabend zählen, sobald der Endstand steht.
  useEffect(() => {
    if (!state || !myPlayer || state.phase !== 'scoreboard' || !state.round) return
    const winner = findMatchWinner(state.round.teams, state.matchPoints)
    const day = new Date().toISOString().slice(0, 10)
    const key = `${roomCode}:${day}:${JSON.stringify(state.matchPoints)}`
    saveNight(key, !!winner && winner.id === myPlayer.teamId)
  }, [state, myPlayer, roomCode])
}
