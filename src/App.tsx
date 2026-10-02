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
import { CatalogGate } from '@/components/CatalogGate'

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
const SoloPage = lazy(() => import('@/pages/SoloPage'))
const ModesPage = lazy(() => import('@/pages/ModesPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))

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
            <Route path="/setup"      element={<CatalogGate><SetupPage /></CatalogGate>} />
            <Route path="/lobby"      element={<CatalogGate><LobbyPage /></CatalogGate>} />
            <Route path="/game"       element={<CatalogGate><GamePage /></CatalogGate>} />
            <Route path="/scoreboard" element={<CatalogGate><ScoreboardPage /></CatalogGate>} />
            <Route path="/review"     element={<CatalogGate><ReviewPage /></CatalogGate>} />
            <Route path="/room"       element={<RoomEntryPage />} />
            <Route path="/room/:code" element={<CatalogGate><RoomLobbyPage /></CatalogGate>} />
            <Route path="/room-debug" element={<RoomDebugPage />} />
            <Route path="/solo"       element={<CatalogGate><SoloPage /></CatalogGate>} />
            <Route path="/modi"       element={<ModesPage />} />
            <Route path="/profil"     element={<ProfilePage />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GameProvider>
  )
}
