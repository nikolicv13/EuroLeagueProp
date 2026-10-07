import { useAuth } from "../context/auth-context";
import { useNavigate } from "react-router-dom";
import styles from "./TierGate.module.css";

interface TierGateProps {
  requiredTier: "pro";
  children: React.ReactNode;
  featureName?: string;
  compact?: boolean; // 👈 ADD
  fallback?: React.ReactNode;
}

export default function TierGate({
  requiredTier,
  children,
  featureName = "This feature",
  compact = false, // 👈 ADD
  fallback,
}: TierGateProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const tierHierarchy = { free: 0, pro: 1 };
  const userLevel = tierHierarchy[profile?.tier || "free"] || 0;
  const requiredLevel = tierHierarchy[requiredTier] || 0;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Compact mode — inline lock + upgrade text
  if (compact) {
    return (
      <div className={styles.compactLocked}>
        <div className={styles.compactOverlay}>
          <span className={styles.compactLock}>🔒</span>
          <span className={styles.compactText}>Pro only</span>
          <button
            className={styles.compactBtn}
            onClick={() => navigate("/pricing")}
          >
            Upgrade
          </button>
        </div>
        <div className={styles.compactContent}>{children}</div>
      </div>
    );
  }

  // Default full overlay
  return (
    <div className={styles.lockedContainer}>
      <div className={styles.lockedOverlay}>
        <span className={styles.lockIcon}>🔒</span>
        <span className={styles.lockTitle}>Pro Feature</span>
        <span className={styles.lockDesc}>
          {featureName} requires a Pro subscription
        </span>
        <button
          className={styles.upgradeBtn}
          onClick={() => navigate("/pricing")}
        >
          Upgrade to Pro
        </button>
      </div>
      <div className={styles.lockedContent}>{children}</div>
    </div>
  );
}
