import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/auth-context";
import { supabase } from "../lib/supabaseClient";
import styles from "./AccountPage.module.css";

export default function AccountPage() {
  const { user, profile, session, refreshProfile } = useAuth();

  // Profile form — initialize from profile
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

  // Sync form with profile when it loads (using ref to track if already synced)
  const profileSynced = useRef(false);
  useEffect(() => {
    if (profile && !profileSynced.current) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setUsername(profile.username || "");
      profileSynced.current = true;
    }
  }, [profile]);

  // ==========================================
  // SAVE PROFILE
  // ==========================================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: "", text: "" });

    // 👇 TEMPORARY DEBUG — remove after fixing
    console.log("Token exists:", !!session?.access_token);
    console.log(
      "Token preview:",
      session?.access_token?.substring(0, 20) + "...",
    );

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: username.trim(),
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setProfileMsg({ type: "error", text: data.error || "Failed to save" });
        return;
      }

      setProfileMsg({ type: "success", text: "Profile updated!" });
      await refreshProfile();
    } catch {
      setProfileMsg({ type: "error", text: "Network error" });
    } finally {
      setProfileSaving(false);
    }
  };

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg({ type: "", text: "" });

    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      setPasswordSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match" });
      setPasswordSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordMsg({ type: "error", text: error.message });
        return;
      }

      setPasswordMsg({ type: "success", text: "Password changed!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMsg({ type: "error", text: "Failed to change password" });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.accountPage}>
      <div className={styles.accountCard}>
        <h1 className={styles.pageTitle}>Account Settings</h1>

        {/* ===== PROFILE SECTION ===== */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          <p className={styles.sectionDesc}>Update your name and username</p>

          {profileMsg.text && (
            <div
              className={
                profileMsg.type === "error"
                  ? styles.msgError
                  : styles.msgSuccess
              }
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className={styles.formInput}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="User425"
                className={styles.formInput}
              />
              <span className={styles.formHint}>
                This is shown in your profile if no name is set
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                value={user.email || ""}
                className={styles.formInput}
                disabled
              />
              <span className={styles.formHint}>Email cannot be changed</span>
            </div>

            <button
              type="submit"
              className={styles.saveBtn}
              disabled={profileSaving}
            >
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        {/* ===== SECURITY SECTION ===== */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Security</h2>
          <p className={styles.sectionDesc}>Change your password</p>

          {passwordMsg.text && (
            <div
              className={
                passwordMsg.type === "error"
                  ? styles.msgError
                  : styles.msgSuccess
              }
            >
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.formInput}
              />
            </div>

            <button
              type="submit"
              className={styles.saveBtn}
              disabled={passwordSaving}
            >
              {passwordSaving ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>

        {/* ===== SUBSCRIPTION SECTION ===== */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscription</h2>
          <p className={styles.sectionDesc}>Your current plan</p>

          <div className={styles.planGrid}>
            <div
              className={`${styles.planCard} ${
                profile?.tier === "free" ? styles.planCardActive : ""
              }`}
            >
              <div className={styles.planName}>Free</div>
              <div className={styles.planPrice}>$0</div>
              <ul className={styles.planFeatures}>
                <li>1 game per league daily</li>
                <li>View stats from dashboard</li>
                <li>Basic hit rates</li>
              </ul>
              {profile?.tier === "free" && (
                <div className={styles.planCurrent}>Current Plan</div>
              )}
            </div>

            <div
              className={`${styles.planCard} ${
                profile?.tier === "pro"
                  ? styles.planCardActive
                  : styles.planCardPro
              }`}
            >
              <div className={styles.planName}>Pro ⚡</div>
              <div className={styles.planPrice}>
                $9.99<span>/mo</span>
              </div>
              <ul className={styles.planFeatures}>
                <li>All games, all leagues</li>
                <li>Player search</li>
                <li>Advanced filters</li>
                <li>H2H full history</li>
                <li>Similar players</li>
              </ul>
              {profile?.tier === "pro" ? (
                <div className={styles.planCurrentPro}>Current Plan</div>
              ) : (
                <button className={styles.upgradeBtn} disabled>
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
