import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import styles from "./ProfileDropdown.module.css";

export default function ProfileDropdown() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  // Display name: use first+last if set, otherwise username, otherwise email prefix
  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.username || user.email?.split("@")[0] || "User";

  // Avatar initials: first letter of display name
  const initials = displayName[0]?.toUpperCase() || "?";

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.avatar}
        onClick={() => setOpen(!open)}
        aria-label="Profile menu"
      >
        {initials}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userInitials}>{initials}</div>
            <div>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <div className={styles.tierBadge}>
            <span
              className={
                profile?.tier === "pro" ? styles.tierPro : styles.tierFree
              }
            >
              {profile?.tier === "pro" ? "⚡ Pro" : "Free Tier"}
            </span>
          </div>

          <div className={styles.divider} />

          <button
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              navigate("/account");
            }}
          >
            Account Settings
          </button>

          <button
            className={`${styles.menuItem} ${styles.signOut}`}
            onClick={() => {
              setOpen(false);
              signOut();
              navigate("/");
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
