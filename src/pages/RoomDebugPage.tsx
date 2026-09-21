/**
 * `/room-debug` — Kleines Debug-Frontend für den WebSocket-Sync.
 *
 * Bewusst außerhalb des `GameProvider`-Kontexts: dies ist ein Playground,
 * um `useRoomSync` isoliert gegen die deployte Lambda zu testen. Für die
 * echte Player-View kommt später ein Room-Provider (Phase 3c) drum herum.
 *
 * Was hier möglich ist:
 *   - Join in einen frischen oder existierenden Room
 *   - Test-Actions dispatchen (ADD_TEAM, RESET_ALL, TOGGLE_MODE)
 *   - Kompletten State als JSON inspizieren
 *   - Status-Änderungen (connecting/joined/reconnecting) live sehen
 *
 * Erreichbar unter `/room-debug`. Erwartet `VITE_WS_URL` im Environment.
 */

import { useState } from 'react'
import type { GameAction } from '@quizapp/shared'
import { useRoomSync } from '@/hooks/useRoomSync'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'

export default function RoomDebugPage() {
  const wsUrl = import.meta.env.VITE_WS_URL
  const [roomCode, setRoomCode] = useState('TEST')
  const [playerName, setPlayerName] = useState('Sara')
  const [role, setRole] = useState<'player' | 'master'>('player')
  const [enabled, setEnabled] = useState(false)

  const room = useRoomSync({
    wsUrl,
    roomCode,
    playerName,
    role,
    enabled,
  })

  const canDispatch = room.status === 'joined' && role === 'player'

  const send = (action: GameAction) => {
    if (!canDispatch) return
    room.dispatch(action)
  }

  return (
    <ScreenLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-white">Room-Debug</h1>

        {!wsUrl && (
          <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
            <strong>VITE_WS_URL nicht gesetzt.</strong> Trag den WebSocket-Endpoint
            in <code>.env.local</code> ein und starte <code>npm run dev</code> neu.
          </Card>
        )}

        {/* Connection form */}
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-white/80">
              Room-Code
              <input
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-white"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                disabled={enabled}
                maxLength={8}
              />
            </label>
            <label className="text-sm text-white/80">
              Player-Name
              <input
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-white"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={enabled}
              />
            </label>
            <label className="text-sm text-white/80">
              Rolle
              <select
                className="mt-1 w-full rounded bg-white/10 px-3 py-2 text-white"
                value={role}
                onChange={(e) => setRole(e.target.value as 'player' | 'master')}
                disabled={enabled}
              >
                <option value="player">player</option>
                <option value="master">master</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            {!enabled ? (
              <Button onClick={() => setEnabled(true)} disabled={!wsUrl}>
                Verbinden
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEnabled(false)}>
                Trennen
              </Button>
            )}
          </div>
        </Card>

        {/* Status + PlayerId */}
        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-4 text-sm text-white/80">
            <StatusPill status={room.status} />
            {room.playerId && (
              <span className="font-mono text-xs">
                playerId: {room.playerId}
              </span>
            )}
          </div>
          {room.lastError && (
            <div className="rounded bg-red-500/20 p-2 text-sm text-red-200">
              {room.lastError}
            </div>
          )}
        </Card>

        {/* Test actions */}
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-medium text-white">Test-Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => send({ type: 'ADD_TEAM' })}
              disabled={!canDispatch}
            >
              ADD_TEAM
            </Button>
            <Button
              variant="secondary"
              onClick={() => send({ type: 'TOGGLE_MODE', modeId: 'flash' })}
              disabled={!canDispatch}
            >
              TOGGLE_MODE flash
            </Button>
            <Button
              variant="secondary"
              onClick={() => send({ type: 'RESET_ALL' })}
              disabled={!canDispatch}
            >
              RESET_ALL
            </Button>
          </div>
          {role === 'master' && (
            <p className="text-xs text-white/60">
              Master-Rolle: Dispatch ist serverseitig gesperrt (ROLE_NOT_ALLOWED).
            </p>
          )}
        </Card>

        {/* State dump */}
        <Card className="space-y-2 p-4">
          <h2 className="text-lg font-medium text-white">State-Snapshot</h2>
          {room.state ? (
            <div className="grid gap-2 text-xs">
              <StateSummary state={room.state} />
              <details className="rounded bg-black/40 p-3">
                <summary className="cursor-pointer text-white/70">
                  komplettes JSON
                </summary>
                <pre className="mt-2 overflow-x-auto text-white/80">
                  {JSON.stringify(room.state, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-sm text-white/50">
              Kein State — noch nicht joined.
            </p>
          )}
        </Card>
      </div>
    </ScreenLayout>
  )
}

function StatusPill({ status }: { status: ReturnType<typeof useRoomSync>['status'] }) {
  const tone = {
    idle: 'bg-white/10 text-white/60',
    connecting: 'bg-blue-500/20 text-blue-200',
    joining: 'bg-blue-500/20 text-blue-200',
    joined: 'bg-emerald-500/20 text-emerald-200',
    reconnecting: 'bg-amber-500/20 text-amber-200',
    error: 'bg-red-500/20 text-red-200',
  }[status]
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      status: {status}
    </span>
  )
}

function StateSummary({ state }: { state: import('@quizapp/shared').GameState }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-white/80 sm:grid-cols-3">
      <Info label="phase" value={state.phase} />
      <Info label="lobbyStep" value={state.lobbyStep} />
      <Info label="teams" value={String(state.draft.teams.length)} />
      <Info label="selectedModes" value={state.draft.selectedModes.length.toString()} />
      <Info label="round" value={state.round ? '✓' : '—'} />
      <Info label="live-kind" value={state.live?.kind ?? '—'} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-mono">
      <span className="text-white/50">{label}=</span>
      {value}
    </span>
  )
}
