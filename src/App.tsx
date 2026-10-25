import { AuthProvider, useAuth } from './auth/AuthContext'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

function AppShell() {
  const { user } = useAuth()
  return user ? <DashboardPage /> : <LoginPage />
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
