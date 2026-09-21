/**
 * App-Root — Router + globaler GameProvider.
 *
 * Route-basiertes Code-Splitting: alle Pages außer der Home-Route werden
 * lazy geladen, damit der Initial-Bundle klein bleibt. Der Roundtrip beim
 * ersten Wechsel (z. B. Home → Setup) kostet einmalig ~50-150 ms Netzwerk-
 * Latenz für den passenden Chunk, danach ist alles im Browser-Cache.
 *
 * Loading-Fallback: minimalistischer Vollbild-Spinner in `PageFallback`,
 * damit Übergänge nicht als weißes Flackern wahrgenommen werden.
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { GameProvider } from '@/context/GameContext'
import HomePage from '@/pages/HomePage'

// Alle anderen Routen werden lazy nachgeladen — jede bekommt einen eigenen
// JS-Chunk. So enthält der Initial-Load nur Home + Provider + shared/Reducer.
const SetupPage = lazy(() => import('@/pages/SetupPage'))
const LobbyPage = lazy(() => import('@/pages/LobbyPage'))
const GamePage = lazy(() => import('@/pages/GamePage'))
const ScoreboardPage = lazy(() => import('@/pages/ScoreboardPage'))
const ReviewPage = lazy(() => import('@/pages/ReviewPage'))
const RoomEntryPage = lazy(() => import('@/pages/RoomEntryPage'))
const RoomLobbyPage = lazy(() => import('@/pages/RoomLobbyPage'))
const RoomDebugPage = lazy(() => import('@/pages/RoomDebugPage'))

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900">
      <Loader2 className="h-8 w-8 animate-spin text-brand-purple-soft" />
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"           element={<HomePage />} />
            <Route path="/setup"      element={<SetupPage />} />
            <Route path="/lobby"      element={<LobbyPage />} />
            <Route path="/game"       element={<GamePage />} />
            <Route path="/scoreboard" element={<ScoreboardPage />} />
            <Route path="/review"     element={<ReviewPage />} />
            <Route path="/room"       element={<RoomEntryPage />} />
            <Route path="/room/:code" element={<RoomLobbyPage />} />
            <Route path="/room-debug" element={<RoomDebugPage />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GameProvider>
  )
}
