/**
 * Simulierter Multi-Device-Abend: echte WS-Handler (Join, Dispatch, Rechte),
 * nur DynamoDB, Broadcast und Kennzahlen sind durch In-Memory-Fakes ersetzt.
 * Mehrere „Handys" sind einfach mehrere connectionIds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import type { GameState, ServerMessage } from '@quizapp/shared'

const rooms = new Map<string, any>()
const sessions = new Map<string, any>()
const inbox = new Map<string, ServerMessage[]>()
const groupHistory = new Map<string, string[]>()

vi.mock('../db', () => ({
  getRoom: async (code: string) => rooms.get(code) ?? null,
  putRoom: async (r: any) => {
    const full = { ...r, updatedAt: '', expiresAt: 0 }
    rooms.set(r.roomCode, full)
    return full
  },
  saveSession: async (s: any) => {
    sessions.set(s.connectionId, s)
    return s
  },
  getSession: async (id: string) => sessions.get(id) ?? null,
  listConnectionsInRoom: async (code: string) => [...sessions.values()].filter((x) => x.roomCode === code),
}))

vi.mock('../broadcast', () => ({
  sendToConnection: async (_e: unknown, id: string, msg: ServerMessage) => {
    inbox.set(id, [...(inbox.get(id) ?? []), msg])
  },
  broadcastToRoom: async (_e: unknown, roomCode: string, msg: ServerMessage, except?: string) => {
    let sent = 0
    for (const s of sessions.values()) {
      if (s.roomCode !== roomCode || s.connectionId === except) continue
      inbox.set(s.connectionId, [...(inbox.get(s.connectionId) ?? []), msg])
      sent++
    }
    return { sent, gone: 0 }
  },
}))

vi.mock('../insights', () => ({
  countMetric: async () => undefined,
  isValidGroupId: (id: unknown) => typeof id === 'string' && id.length >= 8,
  getGroupHistory: async (id: string) => groupHistory.get(id) ?? [],
  saveGroupHistory: async (id: string, ids: string[]) => {
    groupHistory.set(id, [...ids])
  },
}))

const { handleMessage } = await import('./message')

function ev(connectionId: string, body: unknown): APIGatewayProxyWebsocketEventV2 {
  return { requestContext: { connectionId, routeKey: '$default' }, body: JSON.stringify(body) } as never
}
const send = (conn: string, body: unknown) => handleMessage(ev(conn, body))
const last = (conn: string) => (inbox.get(conn) ?? []).at(-1)
const stateOf = (code: string): GameState => rooms.get(code).state
const errors = (conn: string) => (inbox.get(conn) ?? []).filter((m) => m.type === 'ERROR')

beforeEach(() => {
  rooms.clear()
  sessions.clear()
  inbox.clear()
})

async function setupNight(code = 'TEST') {
  await send('host', { type: 'JOIN_ROOM', roomCode: code, playerName: 'Host', role: 'host', groupId: 'group-1234' })
  await send('ana', { type: 'JOIN_ROOM', roomCode: code, playerName: 'Ana', role: 'player' })
  await send('ben', { type: 'JOIN_ROOM', roomCode: code, playerName: 'Ben', role: 'player' })
  return code
}

describe('Multi-Device-Abend (simuliert)', () => {
  it('Host eröffnet, Spieler treten bei, alle bekommen JOINED/STATE', async () => {
    const code = await setupNight()
    expect(last('host')?.type).toBe('STATE')
    expect(last('ana')?.type).toBe('STATE')
    expect(last('ben')?.type).toBe('JOINED')
    const roles = [...sessions.values()].map((s) => s.role).sort()
    expect(roles).toEqual(['host', 'player', 'player'])
    expect(rooms.get(code).groupId).toBe('group-1234')
  })

  it('Spieler können keine Host-Aktionen auslösen, der Host schon', async () => {
    const code = await setupNight()
    await send('ana', { type: 'DISPATCH', action: { type: 'SET_MODE_SELECTION', modeIds: ['flash'] } })
    expect(errors('ana').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
    const before = stateOf(code)
    await send('ana', { type: 'DISPATCH', action: { type: 'GO_TO_LOBBY' } })
    expect(stateOf(code)).toEqual(before)
  })

  it('kompletter Ablauf: Teams, Start, Blitzrunde mit Team-Bindung', async () => {
    const code = await setupNight()
    // Räume starten direkt in der Lobby; Host stellt die Modi dort ein.
    await send('host', { type: 'DISPATCH', action: { type: 'SET_ROUND_MODES', modes: ['flash'] } })
    const s0 = stateOf(code)
    expect(s0.phase).toBe('lobby')
    const [t1, t2] = s0.round!.teams.map((t) => t.id)
    const pid = (c: string) => sessions.get(c).playerId
    await send('ana', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('ana'), teamId: t1 } })
    await send('ben', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('ben'), teamId: t2 } })
    // Ben darf Ana nicht umsetzen.
    await send('ben', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('ana'), teamId: t2 } })
    expect(errors('ben').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
    await send('host', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('host'), teamId: t1 } })
    await send('host', { type: 'DISPATCH', action: { type: 'START_PLAYING' } })
    const s1 = stateOf(code)
    expect(s1.phase).toBe('playing')
    expect(s1.live?.kind).toBe('flash')
    // Ana tippt für ihr Team — erlaubt; für das andere Team — abgelehnt.
    await send('ana', { type: 'DISPATCH', action: { type: 'FLASH_SET_ANSWER', teamId: t1, answer: true } })
    await send('ana', { type: 'DISPATCH', action: { type: 'FLASH_SET_ANSWER', teamId: t2, answer: false } })
    expect(errors('ana').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
    await send('ben', { type: 'DISPATCH', action: { type: 'FLASH_SET_ANSWER', teamId: t2, answer: false } })
    // Auflösen darf nur der Host.
    await send('ben', { type: 'DISPATCH', action: { type: 'FLASH_REVEAL' } })
    expect(errors('ben').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
    await send('host', { type: 'DISPATCH', action: { type: 'FLASH_REVEAL' } })
    const s2 = stateOf(code)
    if (s2.live?.kind !== 'flash') throw new Error('flash erwartet')
    expect(s2.live.phase).toBe('revealed')
    // Alle drei Handys haben den neuen Stand bekommen.
    for (const c of ['host', 'ana', 'ben']) expect(last(c)).toMatchObject({ type: 'STATE' })
  })

  it('Gruppen-Historie: gestellte Fragen wandern in den nächsten Abend', async () => {
    groupHistory.set('group-9999', ['q-alt-1', 'q-alt-2'])
    await send('host2', { type: 'JOIN_ROOM', roomCode: 'NEXT', playerName: 'Host', role: 'host', groupId: 'group-9999' })
    expect(rooms.get('NEXT').askedQuestionIds).toEqual(expect.arrayContaining(['q-alt-1', 'q-alt-2']))
  })

  it('„Modi neu wählen" → Lobby: echte Spieler bleiben im Roster, keine Platzhalter', async () => {
    const code = await setupNight()
    await send('host', { type: 'DISPATCH', action: { type: 'BACK_TO_SETUP' } })
    expect(stateOf(code).phase).toBe('setup')
    await send('host', { type: 'DISPATCH', action: { type: 'SET_MODE_SELECTION', modeIds: ['sprinter'] } })
    await send('host', { type: 'DISPATCH', action: { type: 'INIT_MULTIPLAYER_ROUND' } })
    const s = stateOf(code)
    expect(s.phase).toBe('lobby')
    expect(s.round!.players.map((p) => p.name).sort()).toEqual(['Ana', 'Ben', 'Host'])
  })

  describe('Geo-Modi über echte Geräte', () => {
    /** Host + Ana (Team 1) + Ben (Team 2), Modus starten. */
    async function startGeo(mode: string) {
      const code = await setupNight()
      await send('host', { type: 'DISPATCH', action: { type: 'SET_ROUND_MODES', modes: [mode] } })
      const [t1, t2] = stateOf(code).round!.teams.map((t) => t.id)
      const pid = (c: string) => sessions.get(c).playerId
      await send('ana', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('ana'), teamId: t1 } })
      await send('ben', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('ben'), teamId: t2 } })
      await send('host', { type: 'DISPATCH', action: { type: 'MOVE_PLAYER_TO_TEAM', playerId: pid('host'), teamId: t1 } })
      await send('host', { type: 'DISPATCH', action: { type: 'START_PLAYING' } })
      const live = stateOf(code).live as any
      expect(live?.kind).toBe('geoguess')
      return { code, t1, t2 }
    }
    const geo = (code: string) => stateOf(code).live as any

    for (const [mode, variant] of [['geoguess', 'place'], ['geo-hints', 'hints'], ['geo-shape', 'shape'], ['geo-history', 'history']] as const) {
      it(`${mode}: Nadeln, Team-Bindung, Auflösung, Weiter`, async () => {
        const { code, t1, t2 } = await startGeo(mode)
        expect(geo(code).variant).toBe(variant)
        const target = geo(code).place
        // Ana setzt für ihr Team (erlaubt) und versucht es fürs Gegnerteam (verboten).
        await send('ana', { type: 'DISPATCH', action: { type: 'GEO_SET_PIN', teamId: t1, lat: target.lat, lon: target.lon } })
        await send('ana', { type: 'DISPATCH', action: { type: 'GEO_SET_PIN', teamId: t2, lat: 0, lon: 0 } })
        expect(errors('ana').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
        await send('ben', { type: 'DISPATCH', action: { type: 'GEO_SET_PIN', teamId: t2, lat: target.lat - 20, lon: target.lon } })
        // Nur der Host darf auflösen bzw. Hinweise aufdecken.
        await send('ben', { type: 'DISPATCH', action: { type: 'GEO_REVEAL' } })
        expect(errors('ben').at(-1)).toMatchObject({ code: 'FORBIDDEN' })
        if (variant === 'hints') {
          await send('ben', { type: 'DISPATCH', action: { type: 'GEO_HINT' } })
          expect(geo(code).revealedHints).toBe(1)
          await send('host', { type: 'DISPATCH', action: { type: 'GEO_HINT' } })
          expect(geo(code).revealedHints).toBe(2)
        }
        await send('host', { type: 'DISPATCH', action: { type: 'GEO_REVEAL' } })
        const live = geo(code)
        expect(live.phase).toBe('revealed')
        expect(live.lastResult[t1].closest).toBe(true)
        expect(live.lastResult[t1].points).toBeGreaterThan(live.lastResult[t2].points)
        expect(live.scores[t1]).toBe(live.lastResult[t1].points)
        // Alle drei Geräte haben den neuen Stand bekommen.
        for (const c of ['host', 'ana', 'ben']) expect(last(c)).toMatchObject({ type: 'STATE' })
        // Nach der Auflösung ist die Nadel eingefroren.
        await send('ben', { type: 'DISPATCH', action: { type: 'GEO_SET_PIN', teamId: t2, lat: target.lat, lon: target.lon } })
        expect(geo(code).pins[t2].lat).toBeCloseTo(target.lat - 20, 1)
        await send('host', { type: 'DISPATCH', action: { type: 'GEO_NEXT' } })
        expect(geo(code).currentIndex).toBe(1)
        expect(geo(code).place.id).not.toBe(target.id)
        expect(geo(code).pins[t1]).toBeNull()
      })
    }
  })
})
