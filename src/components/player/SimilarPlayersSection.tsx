import type { SimilarPlayer, CurrentTip } from "../../api/types";
import styles from "./SimilarPlayers.module.css";

interface SimilarPlayersSectionProps {
  similarPlayers: SimilarPlayer[];
  tip: CurrentTip;
}

export default function SimilarPlayersSection({
  similarPlayers,
  tip,
}: SimilarPlayersSectionProps) {
  if (similarPlayers.length === 0 || !tip.opponent_team_id || !tip.position)
    return null;

  return (
    <div className={styles.similarPlayersContainer}>
      <h3 className={styles.similarPlayersTitle}>
        Similar {tip.position || "Player"}s vs{" "}
        {tip.opponent || tip.opponent_team_id} (Last 10)
      </h3>
      {similarPlayers.map((p) => {
        const isOver =
          parseFloat(String(p.game_stat)) >= parseFloat(String(p.avg_stat));
        const dateFormatted = new Date(p.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        return (
          <div key={p.player_id} className={styles.similarPlayerRow}>
            <div className={styles.similarPlayerInfo}>
              <img
                className={styles.similarPlayerTeamLogo}
                src={`/logos/${p.team_id}.png`}
                alt={p.team_id}
              />
              <span className={styles.similarPlayerName}>{p.player}</span>
            </div>
            <div className={styles.similarPlayerStats}>
              <span className={styles.similarPlayerAvg}>
                Avg: {parseFloat(String(p.avg_stat)).toFixed(1)}
              </span>
              <span
                className={
                  isOver
                    ? styles.similarPlayerGameStatOver
                    : styles.similarPlayerGameStatUnder
                }
              >
                {isOver ? "▲" : "▼"} {p.game_stat} ({dateFormatted})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
