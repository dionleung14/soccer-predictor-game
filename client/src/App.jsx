import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth/AuthContext'
import AppHeader from './components/AppHeader'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import MyPicksPage from './pages/MyPicksPage'
import CompetitionPage from './pages/CompetitionPage'
import LeaguesPage from './pages/LeaguesPage'
import LeagueDetailPage from './pages/LeagueDetailPage'
import JoinLeaguePage from './pages/JoinLeaguePage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/competitions/:competitionSlug" element={<CompetitionPage />} />
          <Route path="/leagues/join/:inviteCode" element={<JoinLeaguePage />} />
          <Route
            path="/leagues"
            element={
              <ProtectedRoute>
                <LeaguesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leagues/:slug"
            element={
              <ProtectedRoute>
                <LeagueDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/picks"
            element={
              <ProtectedRoute>
                <MyPicksPage />
              </ProtectedRoute>
            }
          />
          <Route path="/welcome" element={<Navigate to="/profile" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
