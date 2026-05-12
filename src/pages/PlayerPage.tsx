import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchDefenseRankings, fetchPlayerStats } from "../api/api";
import type {
  PlayerGameStat,
  CustomXTickProps,
  DefenseRankings,
  DefenseStatRank,
} from "../api/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import styles from "./PlayerPage.module.css";

function parseMinutes(minStr: string): number {
  if (!minStr || minStr === "DNP") return 0;

  return parseFloat(minStr.replace(":", "."));
}

const CustomXTick = ({ x, y, payload }: CustomXTickProps) => {
  if (x === undefined || y === undefined || !payload?.value) return null;

  // Split the combined value back into date and opponent
  const [dateStr, opponentId] = payload.value.split("|");

  return (
    <g>
      {/* Date Text */}
      <text x={x} y={y + 10} textAnchor="middle" fontSize={12} fill="#666">
        {dateStr}
      </text>

      {/* Opponent Logo */}
      {opponentId && (
        <image
          href={`/logos/${opponentId}.png`}
          x={x - 10}
          y={y + 15}
          width={20}
          height={20}
        />
      )}
    </g>
  );
};
function DefenseBox({
  label,
  stat,
  isActive,
  showRank,
}: {
  label: string;
  stat: DefenseStatRank;
  isActive: boolean;
  showRank: boolean;
}) {
  const getColor = (defLabel: string) => {
    if (defLabel === "Weak") return "#4caf50";
    if (defLabel === "Strong") return "#e94560";
    return "#ffc658";
  };

  const getTrendColor = (direction?: string) => {
    if (direction === "worse") return "#4caf50"; // Green -> Defense is weaker, easier to hit OVER
    if (direction === "better") return "#e94560"; // Red -> Defense is stronger, harder to hit OVER
    return "#888"; // Grey -> About the same
  };

  const color = getColor(stat.label);
  const trendColor = getTrendColor(stat.trend_direction);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "12px 20px",
        borderRadius: "8px",
        background: isActive ? "#f0f0f0" : "transparent",
        border: isActive ? "2px solid #333" : "2px solid transparent",
        minWidth: "80px",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          color: "#666",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>
        {stat.avg}
      </div>

      {/* Show Rank if available (always from season) */}
      {showRank && stat.rank && (
        <div
          style={{
            fontSize: "11px",
            color: color,
            fontWeight: "bold",
            marginTop: "4px",
          }}
        >
          {stat.rank}
          {getOrdinal(stat.rank)}
        </div>
      )}

      {/* Show Trend if available (L5 / L10) */}
      {stat.trend && stat.trend !== "0.0" && (
        <div
          style={{
            fontSize: "11px",
            color: trendColor,
            fontWeight: "bold",
            marginTop: "4px",
          }}
        >
          {stat.trend} vs S
          <span style={{ fontSize: "9px", marginLeft: "2px", opacity: 0.8 }}>
            (Avg: {stat.season_avg})
          </span>
        </div>
      )}
    </div>
  );
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
// Format date to "Mar 13"
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format date to "March 13, 2025"
function formatDateFull(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PlayerGameStat }>;
  marketKeyStr: string;
  marketLabelStr: string;
}

const CustomTooltip = ({
  active,
  payload,
  marketKeyStr,
  marketLabelStr,
}: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipDate}>{formatDateFull(data.date)}</p>
        <p className={styles.tooltipScore}>
          {data.team_a} {data.score_a} - {data.score_b} {data.team_b}
        </p>
        <p className={styles.tooltipMarket}>
          {marketLabelStr}: {data[marketKeyStr as keyof PlayerGameStat]}
        </p>
      </div>
    );
  }
  return null;
};

// Hit Rate Box Component
function HitRateBox({
  label,
  hr,
}: {
  label: string;
  hr?: { hits: number; attempts: number; rate: number };
}) {
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

export default function PlayerStats() {
  const location = useLocation();
  const navigate = useNavigate();

  const tip = location.state as {
    player_id: string;
    player: string;
    position: string;
    market: string;
    line: number;
    selection: "over" | "under";
    opponent_team_id: string;
    opponent: string;
    team_id: string;
    game_id: string; // <-- ADD
    start_time: string;
    hit_rates?: {
      season: { hits: number; attempts: number; rate: number };
      last5: { hits: number; attempts: number; rate: number };
      last10: { hits: number; attempts: number; rate: number };
      last15: { hits: number; attempts: number; rate: number };
      vs_opp?: { hits: number; attempts: number; rate: number };
    };
  };

  const [stats, setStats] = useState<PlayerGameStat[]>([]);
  const [activeFilter, setActiveFilter] = useState<"5" | "10" | "15" | "h2h">(
    "10",
  );
  const [activeMetric, setActiveMetric] = useState<"minutes" | "fga" | "3pta">(
    "minutes",
  );
  const [defenseData, setDefenseData] = useState<DefenseRankings | null>(null);
  const [defenseLimit, setDefenseLimit] = useState<string>("season");
  useEffect(() => {
    if (!tip?.player_id) return;

    async function loadStats() {
      let limit = parseInt(activeFilter);
      let opponent = undefined;

      if (activeFilter === "h2h") {
        limit = 15;
        opponent = tip.opponent_team_id;
      }

      const data = await fetchPlayerStats(tip.player_id, limit, opponent);
      const reversed = data.reverse();

      const formatted = reversed.map((game) => {
        const playerTeamId = game.team_id || tip.team_id;
        const isTeamA = game.team_id_a === playerTeamId;
        const opponentId = isTeamA ? game.team_id_b : game.team_id_a;

        return {
          ...game,
          parsedMinutes: Math.round(parseMinutes(game.minutes)),
          fga:
            (parseInt(String(game.two_points_attempted)) || 0) +
            (parseInt(String(game.three_points_attempted)) || 0),
          three_points_attempted:
            parseInt(String(game.three_points_attempted)) || 0,
          opponent_id: opponentId,
          dateFormatted: formatDate(game.date) + "|" + opponentId,
        };
      });

      setStats(formatted);
    }

    loadStats();
  }, [activeFilter, tip]);
  useEffect(() => {
    if (!tip?.opponent_team_id || !tip?.position || !tip?.market) return;

    async function loadDefense() {
      try {
        const data = await fetchDefenseRankings(
          tip.opponent_team_id,
          tip.position || "PG",
          defenseLimit,
        );
        setDefenseData(data); // Changed from setDefenseRankings
      } catch (err) {
        console.error(err);
      }
    }

    loadDefense();
  }, [tip, defenseLimit]);
  if (!tip) {
    return (
      <div className={styles.noData}>
        <p>No player data provided. Go back to the dashboard.</p>
        <button onClick={() => navigate("/")}>Go Back</button>
      </div>
    );
  }

  const marketKey = () => {
    switch (tip.market) {
      case "points":
        return "points";
      case "assists":
        return "assists";
      case "rebounds":
        return "total_rebounds";
      case "threes_made":
        return "three_points_made";
      default:
        return "points";
    }
  };

  const marketLabel = () => {
    switch (tip.market) {
      case "points":
        return "Points";
      case "assists":
        return "Assists";
      case "rebounds":
        return "Rebounds";
      case "threes_made":
        return "3PT Made";
      default:
        return "Points";
    }
  };

  const showFga = tip.market === "points";
  const show3pta = tip.market === "points" || tip.market === "threes_made";

  const getBarColor = (value: number) => {
    const sel = tip.selection || "over"; // Fallback to "over"
    if (sel === "over") {
      return value > tip.line ? "#4caf50" : "#e94560";
    }
    return value < tip.line ? "#4caf50" : "#e94560";
  };

  return (
    <div className={styles.container}>
      {/* Back Button & Header */}
      <button onClick={() => navigate("/")} className={styles.backButton}>
        ← Back to Dashboard
      </button>

      <h2 className={styles.title}>{tip.player}</h2>
      <p className={styles.subtitle}>
        {marketLabel()} | Line: {tip.line} | vs {tip.opponent}
      </p>

      {/* Hit Rate Boxes */}
      <div className={styles.hitRatesContainer}>
        <HitRateBox label="L5" hr={tip.hit_rates?.last5} />
        <HitRateBox label="L10" hr={tip.hit_rates?.last10} />
        <HitRateBox label="L15" hr={tip.hit_rates?.last15} />
        <HitRateBox label="Season" hr={tip.hit_rates?.season} />
        <HitRateBox
          label={`VS ${tip.opponent_team_id}`}
          hr={tip.hit_rates?.vs_opp}
        />
      </div>

      {/* Game Filter Buttons */}
      <div className={styles.filterButtons}>
        {(["5", "10", "15", "h2h"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`${styles.filterButton} ${
              activeFilter === f ? styles.filterButtonActive : ""
            }`}
          >
            {f === "h2h" ? "H2H" : `Last ${f}`}
          </button>
        ))}
      </div>

      {/* MAIN CHART: Market Stats */}
      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>{marketLabel()} per Game</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="dateFormatted"
              tick={<CustomXTick />}
              interval={0} // Forces all labels to show
              height={50} // Make room for the logo
            />
            <YAxis />
            <Tooltip
              content={
                <CustomTooltip
                  marketKeyStr={marketKey()}
                  marketLabelStr={marketLabel()}
                />
              }
            />
            <ReferenceLine
              y={tip.line}
              stroke="#000000"
              strokeWidth={2}
              label={{
                value: `Line: ${tip.line}`,
                position: "insideTopRight",
                fill: "#000000",
                fontWeight: "bold",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey={marketKey()}
              radius={[4, 4, 0, 0]}
              label={{
                position: "center",
                fill: "#ffffff",
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              {stats.map((entry, index) => {
                // Get the stat value for this specific game
                const value = entry[
                  marketKey() as keyof PlayerGameStat
                ] as number;
                return <Cell key={`cell-${index}`} fill={getBarColor(value)} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SUB-METRIC BUTTONS */}
      <div className={styles.metricButtons}>
        <button
          onClick={() => setActiveMetric("minutes")}
          className={`${styles.metricButton} ${
            activeMetric === "minutes" ? styles.metricButtonActive : ""
          }`}
        >
          Minutes
        </button>

        {showFga && (
          <button
            onClick={() => setActiveMetric("fga")}
            className={`${styles.metricButton} ${
              activeMetric === "fga" ? styles.metricButtonActive : ""
            }`}
          >
            FGA
          </button>
        )}

        {show3pta && (
          <button
            onClick={() => setActiveMetric("3pta")}
            className={`${styles.metricButton} ${
              activeMetric === "3pta" ? styles.metricButtonActive : ""
            }`}
          >
            3PT Attempts
          </button>
        )}
      </div>

      {/* SUB-CHART: Dynamic based on button selected */}
      <div className={styles.subChartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => formatDate(date)}
              tick={{ fontSize: 12 }}
            />
            <YAxis />

            {activeMetric === "minutes" && (
              <Bar
                dataKey="parsedMinutes"
                fill="#e0e0e0"
                radius={[4, 4, 0, 0]}
                name="Minutes"
                label={{
                  position: "center",
                  fill: "#000000",
                  fontSize: 14,
                  fontWeight: "bold",
                }}
              />
            )}
            {activeMetric === "fga" && (
              <Bar
                dataKey="fga"
                fill="#e0e0e0"
                radius={[4, 4, 0, 0]}
                name="FGA"
                label={{
                  position: "center",
                  fill: "#000000",
                  fontSize: 14,
                  fontWeight: "bold",
                }}
              />
            )}
            {activeMetric === "3pta" && (
              <Bar
                dataKey="three_points_attempted"
                fill="#e0e0e0"
                radius={[4, 4, 0, 0]}
                name="3PA"
                label={{
                  position: "center",
                  fill: "#333333",
                  fontSize: 14,
                  fontWeight: "bold",
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Defense Filter Buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {["5", "10", "season"].map((f) => (
          <button
            key={f}
            onClick={() => setDefenseLimit(f)}
            style={{
              padding: "6px 14px",
              background: defenseLimit === f ? "#0f3460" : "#e0e0e0",
              color: defenseLimit === f ? "white" : "black",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
            }}
          >
            {f === "season" ? "Season" : `Last ${f}`}
          </button>
        ))}
      </div>
      {/* OPPONENT DEFENSE RANKINGS */}
      {defenseData && defenseData.stats && (
        <div className={styles.defenseContainer}>
          <h3 className={styles.defenseTitle}>
            {tip.opponent} Defense vs {tip.position || "All"} Position
          </h3>

          {/* TOP ROW: PTS, REB, AST */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginBottom: "10px",
              gap: "10px",
            }}
          >
            <DefenseBox
              label="PTS"
              stat={defenseData.stats.points}
              isActive={tip.market === "points"}
              showRank={defenseLimit === "season"}
            />
            <DefenseBox
              label="REB"
              stat={defenseData.stats.rebounds}
              isActive={tip.market === "rebounds"}
              showRank={defenseLimit === "season"}
            />
            <DefenseBox
              label="AST"
              stat={defenseData.stats.assists}
              isActive={tip.market === "assists"}
              showRank={defenseLimit === "season"}
            />
          </div>

          {/* BOTTOM ROW: 3PT, STL, BLK */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              gap: "10px",
            }}
          >
            <DefenseBox
              label="3PT"
              stat={defenseData.stats.threes}
              isActive={tip.market === "threes_made"}
              showRank={defenseLimit === "season"}
            />
            <DefenseBox
              label="STL"
              stat={defenseData.stats.steals}
              isActive={false}
              showRank={defenseLimit === "season"}
            />
            <DefenseBox
              label="BLK"
              stat={defenseData.stats.blocks}
              isActive={false}
              showRank={defenseLimit === "season"}
            />
          </div>

          {/* LEGEND */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px",
              marginTop: "20px",
              padding: "10px",
              background: "#f9f9f9",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#4caf50",
                  borderRadius: "3px",
                  display: "inline-block",
                }}
              ></span>
              <span>Weak = Green (Bad defense, easier to score)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#e94560",
                  borderRadius: "3px",
                  display: "inline-block",
                }}
              ></span>
              <span>Strong = Red (Good defense, harder to score)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#888888",
                  borderRadius: "3px",
                  display: "inline-block",
                }}
              ></span>
              <span>Average = Gray</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
