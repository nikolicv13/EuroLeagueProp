import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import styles from "./Auth.module.css";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Supabase may require email confirmation depending on your settings
    // If email confirmation is ON, the user gets a confirmation email
    // If it's OFF, they're immediately logged in
    setSuccess("Account created! Check your email for a confirmation link.");
    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Sign Up</h1>
        <p className={styles.authSubtitle}>
          Create a free account to get started
        </p>

        {error && <div className={styles.authError}>{error}</div>}
        {success && <div className={styles.authSuccess}>{success}</div>}

        <form onSubmit={handleSignup} className={styles.authForm}>
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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.formInput}
              required
            />
          </div>

          <button type="submit" className={styles.authBtn} disabled={loading}>
            {loading ? "Creating account..." : "Continue"}
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
          Already have an account?{" "}
          <Link to="/login" className={styles.authLink}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
