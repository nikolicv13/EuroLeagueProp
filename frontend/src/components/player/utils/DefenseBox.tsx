import type { DefenseStatRank } from "../../../api/types";
import { getOrdinal } from "./playerHelpers";
import styles from "./DefenseBox.module.css";

interface DefenseBoxProps {
  label: string;
  stat: DefenseStatRank;
  isActive: boolean;
  showRank: boolean;
}

export default function DefenseBox({
  label,
  stat,
  isActive,
  showRank,
}: DefenseBoxProps) {
  const color =
    stat.label === "Weak"
      ? "#4caf50"
      : stat.label === "Strong"
        ? "#e94560"
        : "#ffc658";
  const trendColor =
    stat.trend_direction === "worse"
      ? "#4caf50"
      : stat.trend_direction === "better"
        ? "#e94560"
        : "#888";

  return (
    <div className={isActive ? styles.defenseBoxActive : styles.defenseBox}>
      <div className={styles.defenseBoxLabel}>{label}</div>
      <div className={styles.defenseBoxValue}>{stat.avg}</div>
      {showRank && stat.rank && (
        <div className={styles.defenseBoxRank} style={{ color }}>
          {stat.rank}
          {getOrdinal(stat.rank)}
        </div>
      )}
      {stat.trend && stat.trend !== "0.0" && (
        <div className={styles.defenseBoxTrend} style={{ color: trendColor }}>
          {stat.trend} vs S{" "}
          <span className={styles.defenseBoxTrendAvg}>
            (Avg: {stat.season_avg})
          </span>
        </div>
      )}
    </div>
  );
}
