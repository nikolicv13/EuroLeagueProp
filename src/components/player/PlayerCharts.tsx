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
import type {
  ChartDataPoint,
  CurrentTip,
  CustomTooltipProps,
} from "../../api/types";
import {
  getMarketKey,
  getMarketLabel,
  getBarColor,
  getStatValue,
  calculateHitRate,
  formatDate,
  formatDateFull,
} from "./utils/playerHelpers";
import HitRateBox from "./utils/HitRateBox";
import styles from "./PlayerCharts.module.css";

const CustomXTick = ({
  x,
  y,
  payload,
  activeFilter,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  activeFilter: string;
}) => {
  if (x === undefined || y === undefined || !payload?.value) return null;
  const [dateStr, opponentId] = payload.value.split("|");
  if (activeFilter === "season" && opponentId)
    return (
      <image
        x={x - 10}
        y={y + 5}
        width={20}
        height={20}
        href={`/logos/${opponentId}.png`}
      />
    );
  return (
    <g>
      <text x={x} y={y + 10} textAnchor="middle" fontSize={12} fill="#666">
        {dateStr}
      </text>
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
          {marketLabelStr}: {data[marketKeyStr as keyof ChartDataPoint]}
        </p>
      </div>
    );
  }
  return null;
};

interface PlayerChartsProps {
  chartData: ChartDataPoint[];
  displayedStats: ChartDataPoint[];
  activeFilter: string;
  setActiveFilter: (f: "5" | "10" | "15" | "h2h" | "season") => void;
  activeMetric: "minutes" | "fga" | "3pta";
  setActiveMetric: (m: "minutes" | "fga" | "3pta") => void;
  tip: CurrentTip;
  fullSeasonChartData: ChartDataPoint[];
  fullH2HChartData: ChartDataPoint[];
  selectedOppPlayer: { id: string; name: string } | null;
}

export default function PlayerCharts(props: PlayerChartsProps) {
  const {
    chartData,
    displayedStats,
    activeFilter,
    setActiveFilter,
    activeMetric,
    setActiveMetric,
    tip,
    fullSeasonChartData,
    fullH2HChartData,
    selectedOppPlayer,
  } = props;
  const mKey = getMarketKey(tip.market);
  const mLabel = getMarketLabel(tip.market);
  const showFga = tip.market === "points";
  const show3pta = tip.market === "points" || tip.market === "threes_made";

  return (
    <>
      <div className={styles.hitRatesContainer}>
        <HitRateBox
          label="L5"
          hr={calculateHitRate(
            fullSeasonChartData
              .slice(-5)
              .map((s) => getStatValue(s, tip.market)),
            tip.line,
            tip.selection,
          )}
        />
        <HitRateBox
          label="L10"
          hr={calculateHitRate(
            fullSeasonChartData
              .slice(-10)
              .map((s) => getStatValue(s, tip.market)),
            tip.line,
            tip.selection,
          )}
        />
        <HitRateBox
          label="L15"
          hr={calculateHitRate(
            fullSeasonChartData
              .slice(-15)
              .map((s) => getStatValue(s, tip.market)),
            tip.line,
            tip.selection,
          )}
        />
        <HitRateBox
          label="Season"
          hr={calculateHitRate(
            fullSeasonChartData.map((s) => getStatValue(s, tip.market)),
            tip.line,
            tip.selection,
          )}
        />
        {!selectedOppPlayer && (
          <HitRateBox
            label={`VS ${tip.opponent_team_id}`}
            hr={calculateHitRate(
              fullH2HChartData.map((s) => getStatValue(s, tip.market)),
              tip.line,
              tip.selection,
            )}
          />
        )}
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterButtons}>
          {(["5", "10", "15", "season", "h2h"] as const).map((f) => {
            if (f === "h2h" && selectedOppPlayer) return null;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`${styles.filterButton} ${activeFilter === f ? styles.filterButtonActive : ""}`}
              >
                {f === "h2h" ? "H2H" : f === "season" ? "Season" : `Last ${f}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>{mLabel} per Game</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="dateFormatted"
              tick={<CustomXTick activeFilter={activeFilter} />}
              interval={0}
              height={50}
            />
            <YAxis />
            <Tooltip
              content={
                <CustomTooltip marketKeyStr={mKey} marketLabelStr={mLabel} />
              }
            />
            <ReferenceLine
              y={tip.line}
              stroke="#000"
              strokeWidth={2}
              label={{
                value: `Line: ${tip.line}`,
                position: "insideTopRight",
                fill: "#000",
                fontWeight: "bold",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey={mKey}
              radius={[4, 4, 0, 0]}
              label={{
                position: "center",
                fill: "#fff",
                fontSize: 14,
                fontWeight: "bold",
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(
                    Number(entry[mKey as keyof ChartDataPoint]),
                    tip.selection,
                    tip.line,
                  )}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.metricButtons}>
        <button
          onClick={() => setActiveMetric("minutes")}
          className={`${styles.metricButton} ${activeMetric === "minutes" ? styles.metricButtonActive : ""}`}
        >
          Minutes
        </button>
        {showFga && (
          <button
            onClick={() => setActiveMetric("fga")}
            className={`${styles.metricButton} ${activeMetric === "fga" ? styles.metricButtonActive : ""}`}
          >
            FGA
          </button>
        )}
        {show3pta && (
          <button
            onClick={() => setActiveMetric("3pta")}
            className={`${styles.metricButton} ${activeMetric === "3pta" ? styles.metricButtonActive : ""}`}
          >
            3PT Attempts
          </button>
        )}
      </div>

      <div className={styles.subChartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayedStats}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
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
                  fill: "#000",
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
                  fill: "#000",
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
                  fill: "#333",
                  fontSize: 14,
                  fontWeight: "bold",
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
