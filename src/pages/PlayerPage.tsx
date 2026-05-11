import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchPlayerStats } from "../api/api";
import type { PlayerGameStat, CustomXTickProps } from "../api/api";
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
                }} // <-- Changed to center/dark (yellow is too light for white)
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
