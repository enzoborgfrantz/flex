import type { AuthUser } from './AuthContext'

const STORAGE_KEY = 'flex.auth-session'

export interface StoredSession {
  accessToken: string
  expiresAt: number
  user: AuthUser
}

export function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StoredSession
    if (session.expiresAt <= Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function saveStoredSession(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY)
}
