import { createContext, useContext, useState, type ReactNode } from 'react'
import { requestGoogleAccessToken, revokeGoogleAccessToken } from './googleClient'
import { clearStoredSession, loadStoredSession, saveStoredSession, type StoredSession } from './session'

export interface AuthUser {
  name: string
  email: string
  picture?: string
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to fetch Google user info')
  const data = await response.json()
  return { name: data.name, email: data.email, picture: data.picture }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // A still-valid cached token (tokens last ~1h) means the user doesn't have
  // to sign in again on every page load.
  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession())
  const [status, setStatus] = useState<AuthStatus>(session ? 'signed-in' : 'signed-out')
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setError(null)
    setStatus('loading')
    try {
      const token = await requestGoogleAccessToken()
      const profile = await fetchUserInfo(token.accessToken)
      const next: StoredSession = { accessToken: token.accessToken, expiresAt: token.expiresAt, user: profile }
      saveStoredSession(next)
      setSession(next)
      setStatus('signed-in')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setStatus('signed-out')
    }
  }

  const signOut = async () => {
    if (session) await revokeGoogleAccessToken(session.accessToken)
    clearStoredSession()
    setSession(null)
    setStatus('signed-out')
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session?.user ?? null,
        accessToken: session?.accessToken ?? null,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
