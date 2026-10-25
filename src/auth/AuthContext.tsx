import { createContext, useContext, useState, type ReactNode } from 'react'

export interface AuthUser {
  name: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Stub implementation — replace with Google Identity Services sign-in/sign-out.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const signIn = () => setUser({ name: 'Test User', email: 'test@example.com' })
  const signOut = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
