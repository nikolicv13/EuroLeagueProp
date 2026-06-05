import styles from "./PlayerHeader.module.css";
import { getTeamColor, getTeamTheme } from "../../utils/teamColors";

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
  const teamColor = getTeamColor(teamId, teamAbbr);
  const theme = getTeamTheme(teamColor);
  const formatMarket = (m: string) => {
    const clean = m.replace(/_alt\d*/g, "");
    switch (clean) {
      case "threes_made":
        return "3PT";
      case "pra":
        return "P+R+A";
      case "pa":
        return "P+A";
      case "pr":
        return "P+R";
      case "ra":
        return "R+A";
      case "steals":
        return "Steals";
      case "blocks":
        return "Blocks";
      default:
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  };
  const cssVars = {
    "--team-bg": theme.bg,
    "--team-text": theme.text,
    "--team-surface": theme.surface,
    "--team-muted": theme.muted,
  } as React.CSSProperties;

  return (
    <div className={styles.headerContainer} style={cssVars}>
      {/* Top Row */}
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

      {/* Middle Row */}
      <div className={styles.playerRow}>
        <h1 className={styles.playerName}>{playerName}</h1>

        <span className={styles.propBadge}>
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
