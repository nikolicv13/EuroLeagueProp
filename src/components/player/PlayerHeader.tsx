import styles from "./PlayerHeader.module.css";

export interface SeasonAverages {
  pts: number;
  reb: number;
  ast: number;
}

interface PlayerHeaderProps {
  playerName: string;
  teamId: string;
  teamAbbr: string;
  position: string;
  opponent?: string;
  opponentTeamId?: string;
  selection: "over" | "under";
  line: number;
  market: string;
  averages: SeasonAverages | null;
  averagesTitle: string;
}

export default function PlayerHeader({
  playerName,
  teamId,
  teamAbbr,
  position,
  opponent,
  opponentTeamId,
  selection,
  line,
  market,
  averages,
  averagesTitle,
}: PlayerHeaderProps) {
  const formatMarket = (m: string) => {
    if (m === "threes_made") return "3PT";
    if (m === "pra") return "P+R+A";
    if (m === "pa") return "P+A";
    if (m === "pr") return "P+R";
    if (m === "ra") return "R+A";
    return m.charAt(0).toUpperCase() + m.slice(1);
  };

  return (
    <div className={styles.headerContainer}>
      {/* Top Row: Team Info (Left) vs Opponent (Right) */}
      <div className={styles.topRow}>
        <div className={styles.teamInfoLeft}>
          <img
            src={`/logos/${teamId}.png`}
            alt={teamAbbr}
            className={styles.teamLogo}
            onError={(e) => (e.currentTarget.src = "/logos/placeholder.png")}
          />
          <span className={styles.teamInfo}>
            {teamAbbr || teamId} | {position || "N/A"}
          </span>
        </div>

        {(opponent || opponentTeamId) && (
          <div className={styles.opponentInfo}>
            vs {opponent || opponentTeamId}
          </div>
        )}
      </div>

      {/* Middle Row: Name & Prop Badge */}
      <div className={styles.playerRow}>
        <h1 className={styles.playerName}>{playerName}</h1>
        <span
          className={`${styles.propBadge} ${selection === "over" ? styles.propBadgeOver : styles.propBadgeUnder}`}
        >
          {selection.toUpperCase()} {line} {formatMarket(market)}
        </span>
      </div>

      {/* Bottom Row: Averages Box */}
      {averages && (
        <div className={styles.averagesBox}>
          <div className={styles.averagesTitle}>{averagesTitle}</div>
          <div className={styles.averagesStats}>
            <div className={styles.avgItem}>
              <div className={styles.avgLabel}>PTS</div>
              <div className={styles.avgValue}>{averages.pts.toFixed(1)}</div>
            </div>
            <div className={styles.avgItem}>
              <div className={styles.avgLabel}>REB</div>
              <div className={styles.avgValue}>{averages.reb.toFixed(1)}</div>
            </div>
            <div className={styles.avgItem}>
              <div className={styles.avgLabel}>AST</div>
              <div className={styles.avgValue}>{averages.ast.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
