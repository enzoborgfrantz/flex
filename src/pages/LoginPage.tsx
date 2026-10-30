import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui";

export function LoginPage() {
  const { signIn, error } = useAuth();

  return (
    <section id="login">
      <div className="login__main">
        <div className="login__brand">
          <Logo />
        </div>
        <Button variant="ivory" onClick={signIn}>
          Sign in with Google
        </Button>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
