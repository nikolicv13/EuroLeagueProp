import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import styles from "./Auth.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigate("/");
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Login</h1>
        <p className={styles.authSubtitle}>
          Join for free and start exploring props
        </p>

        {error && <div className={styles.authError}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={styles.formInput}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.formInput}
              required
            />
          </div>

          <button type="submit" className={styles.authBtn} disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <div className={styles.authDivider}>
          <span>or continue with</span>
        </div>

        <div className={styles.socialButtons}>
          <button className={styles.socialBtn} disabled>
            <span className={styles.socialIcon}>G</span>
            Google
          </button>
          <button className={styles.socialBtn} disabled>
            <span className={styles.socialIcon}>A</span>
            Apple
          </button>
        </div>

        <p className={styles.authSwitch}>
          Need to create an account?{" "}
          <Link to="/signup" className={styles.authLink}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
