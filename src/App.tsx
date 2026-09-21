/**
 * App-Root — Router + globaler GameProvider.
 *
 * Fünf top-level Routen entsprechen den fünf Phasen des Spielzustands:
 *   /            → Home
 *   /setup       → Team- und Modi-Wahl
 *   /lobby       → Ready-State vor Rundenstart
 *   /game        → aktives Spiel (im MVP: Themen-Battle)
 *   /scoreboard  → Endstand
 *
 * Die Pages haben eigene Phase-Guards und leiten bei Fehl-Zustand um. Route-Wechsel bei
 * Reducer-Übergängen erfolgt aktiv im Dispatch-Kontext (siehe useNavigate-Calls dort).
 */

import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { GameProvider } from '@/context/GameContext'
import HomePage from '@/pages/HomePage'
import SetupPage from '@/pages/SetupPage'
import LobbyPage from '@/pages/LobbyPage'
import GamePage from '@/pages/GamePage'
import ScoreboardPage from '@/pages/ScoreboardPage'
import ReviewPage from '@/pages/ReviewPage'
import RoomDebugPage from '@/pages/RoomDebugPage'
import RoomEntryPage from '@/pages/RoomEntryPage'
import RoomLobbyPage from '@/pages/RoomLobbyPage'

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </GameProvider>
  )
}
