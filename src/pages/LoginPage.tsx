import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()

  return (
    <section id="login">
      <h1>flex</h1>
      <p>Sign in with Google to load your workout sessions.</p>
      <button type="button" onClick={signIn}>
        Sign in with Google
      </button>
    </section>
  )
}
