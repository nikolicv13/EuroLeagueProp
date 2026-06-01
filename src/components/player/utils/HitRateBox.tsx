import styles from "./HitRateBox.module.css";

interface HitRateBoxProps {
  label: string;
  hr?: { hits: number; attempts: number; rate: number };
}

export default function HitRateBox({ label, hr }: HitRateBoxProps) {
  if (!hr || hr.attempts === 0) return null;
  const pct = Math.round(hr.rate * 100);
  const percentClass =
    pct >= 70
      ? styles.hitRatePercentHigh
      : pct >= 50
        ? styles.hitRatePercentMid
        : styles.hitRatePercentLow;

  return (
    <div className={styles.hitRateBox}>
      <div className={styles.hitRateLabel}>{label}</div>
      <div className={`${styles.hitRatePercent} ${percentClass}`}>{pct}%</div>
      <div className={styles.hitRateFraction}>
        {hr.hits}/{hr.attempts}
      </div>
    </div>
  );
}
