import type { Tip, CurrentTip } from "../../api/types";
import styles from "./GamePropsSidebar.module.css";

interface GamePropsSidebarProps {
  gameTips: Tip[];
  currentTip: CurrentTip;
  onTipClick: (tip: Tip) => void;
}

export default function GamePropsSidebar({
  gameTips,
  currentTip,
  onTipClick,
}: GamePropsSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <h3 className={styles.sidebarTitle}>
        {currentTip?.team_id || "Team"} vs{" "}
        {currentTip?.opponent_team_id || "Opp"}
      </h3>
      {gameTips.map((t) => {
        const isActive =
          t.player_id === currentTip?.player_id &&
          t.market === currentTip?.market;
        return (
          <div
            key={t.id}
            className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ""}`}
            onClick={() => onTipClick(t)}
          >
            <div className={styles.sidebarPlayerName}>
              {t.player}{" "}
              <span className={styles.sidebarPositionText}>({t.position})</span>
            </div>
            <div className={styles.sidebarPropText}>
              <span
                className={
                  t.selection === "over"
                    ? styles.sidebarOuOver
                    : styles.sidebarOuUnder
                }
              >
                {t.selection === "over" ? "O" : "U"}
              </span>{" "}
              {t.line}{" "}
              {t.market === "threes_made"
                ? "3PT"
                : t.market.charAt(0).toUpperCase() + t.market.slice(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
