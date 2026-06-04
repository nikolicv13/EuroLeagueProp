import type { Tip, CurrentTip } from "../../api/types";
import styles from "./GamePropsSidebar.module.css";

// Shape of the grouped data we will pass from PlayerStats
export interface GroupedProp {
  key: string;
  player: string;
  player_id: string;
  market: string;
  line: number;
  overOdds?: number;
  underOdds?: number;
  overTip?: Tip;
  underTip?: Tip;
  tip: Tip;
}

interface GamePropsSidebarProps {
  availableGames: Tip[];
  selectedGameId: string;
  setSelectedGameId: (id: string) => void;
  propFilter: string;
  setPropFilter: (prop: string) => void;
  groupedTips: GroupedProp[];
  currentTip: CurrentTip;
  onTipClick: (tip: Tip) => void;
}

export default function GamePropsSidebar({
  availableGames,
  selectedGameId,
  setSelectedGameId,
  propFilter,
  setPropFilter,
  groupedTips,
  currentTip,
  onTipClick,
}: GamePropsSidebarProps) {
  const currentGame = availableGames.find((g) => g.game_id === selectedGameId);

  const formatDate = (timeStr: string) => {
    if (!timeStr) return { day: "TBD", time: "TBD" };
    const d = new Date(timeStr);
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      time: d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const formatMarket = (m: string) => {
    // 1. Strip out _alt, _alt1, _alt2, etc.
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

  return (
    <div className={styles.sidebar}>
      {/* Top Filters */}
      <div className={styles.filterRow}>
        <select
          value={propFilter}
          onChange={(e) => setPropFilter(e.target.value)}
          className={styles.selectInput}
        >
          <option value="all">All Props</option>
          <option value="points">Points</option>
          <option value="rebounds">Rebounds</option>
          <option value="assists">Assists</option>
          <option value="threes_made">3PT</option>
          <option value="pra">P+R+A</option>
          <option value="pr">P+R</option>
          <option value="pa">P+A</option>
          <option value="ra">R+A</option>
          <option value="steals">Steals</option>
          <option value="blocks">Blocks</option>
        </select>

        <select
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className={styles.selectInput}
        >
          {availableGames.map((g) => (
            <option key={g.game_id} value={g.game_id}>
              {g.team_abbr || g.team || g.team_id || "Team"} vs{" "}
              {g.opponent_abbr || g.opponent || g.opponent_team_id || "Opp"}
            </option>
          ))}
        </select>
      </div>

      {/* Game Preview */}
      {currentGame && (
        <div className={styles.gamePreview}>
          <div className={styles.teamBlock}>
            <img
              src={`/logos/${currentGame.team_id}.png`}
              alt="Team"
              className={styles.teamLogo}
              onError={(e) => (e.currentTarget.src = "/logos/placeholder.png")}
            />
            <div className={styles.teamAbbr}>
              {currentGame.team_abbr || currentGame.team}
            </div>
          </div>

          <div className={styles.dateBlock}>
            <div className={styles.dateDay}>
              {formatDate(currentGame.start_time).day}
            </div>
            <div className={styles.dateTime}>
              {formatDate(currentGame.start_time).time}
            </div>
          </div>

          <div className={styles.teamBlock}>
            <img
              src={`/logos/${currentGame.opponent_team_id}.png`}
              alt="Opponent"
              className={styles.teamLogo}
              onError={(e) => (e.currentTarget.src = "/logos/placeholder.png")}
            />
            <div className={styles.teamAbbr}>
              {currentGame.opponent_abbr || currentGame.opponent}
            </div>
          </div>
        </div>
      )}

      {/* Props List */}
      <div className={styles.propsList}>
        {groupedTips.map((prop) => {
          const isActiveLine =
            currentTip.player_id === prop.player_id &&
            currentTip.market === prop.market &&
            currentTip.line === prop.line;

          const handleRowClick = () => {
            // Default to "over" if it exists, otherwise fallback to "under"
            const defaultSelection = prop.overOdds ? "over" : "under";
            const defaultOdds =
              prop.overOdds || prop.underOdds || prop.tip.odds;

            // Create a complete synthetic tip to send to the toolbar
            const syntheticTip = {
              ...prop.tip,
              selection: defaultSelection as "over" | "under",
              odds: defaultOdds,
            };

            onTipClick(syntheticTip);
          };

          return (
            <div
              key={prop.key}
              className={`${styles.propItem} ${isActiveLine ? styles.propItemActive : ""}`}
              onClick={handleRowClick}
            >
              <img
                src="/logos/placeholder.png"
                alt="Player"
                className={styles.playerImg}
              />

              <div className={styles.playerInfo}>
                <div className={styles.playerName}>{prop.player}</div>
                <div className={styles.propDetails}>
                  {formatMarket(prop.market)} {prop.line}
                </div>
              </div>

              {/* ODDS CONTAINER */}
              <div className={styles.oddsContainer}>
                {prop.underOdds && (
                  <div
                    className={`${styles.oddBox} ${styles.oddBoxUnder} ${isActiveLine && currentTip.selection === "under" ? styles.oddBoxActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTipClick({
                        ...prop.tip,
                        selection: "under",
                        odds: prop.underOdds!,
                      });
                    }}
                  >
                    U {prop.underOdds.toFixed(2)}
                  </div>
                )}
                {prop.overOdds && (
                  <div
                    className={`${styles.oddBox} ${styles.oddBoxOver} ${isActiveLine && currentTip.selection === "over" ? styles.oddBoxActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTipClick({
                        ...prop.tip,
                        selection: "over",
                        odds: prop.overOdds!,
                      });
                    }}
                  >
                    O {prop.overOdds.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {groupedTips.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#888",
              fontSize: "13px",
              padding: "20px 0",
            }}
          >
            No props found for this filter.
          </div>
        )}
      </div>
    </div>
  );
}
