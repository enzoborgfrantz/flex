import { AuthProvider, useAuth } from './auth/AuthContext'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

function AppShell() {
  const { status } = useAuth()
  if (status === 'loading') return <p id="loading">Loading…</p>
  return status === 'signed-in' ? <DashboardPage /> : <LoginPage />
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
