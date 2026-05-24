import { useState, useEffect } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  fetchDefenseRankings,
  fetchPlayerSearch,
  fetchPlayerStats,
  fetchTips,
  fetchSimilarPlayers,
} from "../api/api";
import type {
  PlayerGameStat,
  CustomXTickProps,
  DefenseRankings,
  DefenseStatRank,
  SimilarPlayer,
  PlayerSearchResult,
  Tip,
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

// Calculate hit rate from actual graph values
function calculateHitRate(
  values: number[],
  line: number,
  selection: "over" | "under",
) {
  if (values.length === 0) return { hits: 0, attempts: 0, rate: 0 };

  let hits = 0;
  for (const value of values) {
    if (selection === "over" && value > line) hits++;
    if (selection === "under" && value < line) hits++;
  }

  return { hits, attempts: values.length, rate: hits / values.length };
}

const CustomXTick = ({ x, y, payload, activeFilter }: CustomXTickProps) => {
  if (x === undefined || y === undefined || !payload?.value) return null;

  const [dateStr, opponentId] = payload.value.split("|");

  if (activeFilter === "season" && opponentId) {
    return (
      <image
        x={x - 10}
        y={y + 5}
        width={20}
        height={20}
        href={`/logos/${opponentId}.png`}
      />
    );
  }

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
    if (direction === "worse") return "#4caf50";
    if (direction === "better") return "#e94560";
    return "#888";
  };

  const color = getColor(stat.label);
  const trendColor = getTrendColor(stat.trend_direction);

  return (
    <div className={isActive ? styles.defenseBoxActive : styles.defenseBox}>
      <div className={styles.defenseBoxLabel}>{label}</div>
      <div className={styles.defenseBoxValue}>{stat.avg}</div>

      {showRank && stat.rank && (
        <div className={styles.defenseBoxRank} style={{ color: color }}>
          {stat.rank}
          {getOrdinal(stat.rank)}
        </div>
      )}

      {stat.trend && stat.trend !== "0.0" && (
        <div className={styles.defenseBoxTrend} style={{ color: trendColor }}>
          {stat.trend} vs S
          <span className={styles.defenseBoxTrendAvg}>
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

  const { playerId } = useParams();
  const [searchParams] = useSearchParams();

  const [savedState] = useState(
    location.state as {
      player_id: string;
      player: string;
      position: string;
      market: string;
      line: number;
      selection: "over" | "under";
      opponent_team_id: string;
      opponent: string;
      team_id: string;
      game_id: string;
      season_code: string;
      start_time: string;
      hit_rates?: {
        season: { hits: number; attempts: number; rate: number };
        last5: { hits: number; attempts: number; rate: number };
        last10: { hits: number; attempts: number; rate: number };
        last15: { hits: number; attempts: number; rate: number };
        vs_opp?: { hits: number; attempts: number; rate: number };
      };
    } | null,
  );
  const getParam = (key: string, fallback: string) => {
    const val = searchParams.get(key);
    return val && val !== "null" ? val : fallback;
  };

  // 2. Merge URL params with SAVED State (URL wins for prop/line/overUnder)
  const tip = {
    ...savedState,
    player_id: playerId || savedState?.player_id || "",
    market: getParam("propType", savedState?.market || "points"),
    line: parseFloat(
      getParam("propAmount", String(savedState?.line || "10.5")),
    ),
    selection: getParam("overUnder", savedState?.selection || "over") as
      | "over"
      | "under",
    opponent_team_id: getParam("oppTeam", savedState?.opponent_team_id || ""),
    opponent: getParam("oppName", "")
      ? decodeURIComponent(getParam("oppName", ""))
      : savedState?.opponent || "",
    team_id: getParam("teamId", savedState?.team_id || ""),
    position: getParam("position", savedState?.position || ""),
    season: getParam("season", savedState?.season_code || "E2025"),
  };
  const [stats, setStats] = useState<PlayerGameStat[]>([]);
  const [h2hStats, setH2hStats] = useState<PlayerGameStat[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "5" | "10" | "15" | "h2h" | "season"
  >("10");
  const [activeMetric, setActiveMetric] = useState<"minutes" | "fga" | "3pta">(
    "minutes",
  );
  const [venueFilter, setVenueFilter] = useState<"all" | "home" | "away">(
    "all",
  );
  const [selectedSeason, setSelectedSeason] = useState<string>("E2025");
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([
    "euroleague",
  ]);
  const [defenseData, setDefenseData] = useState<DefenseRankings | null>(null);
  const [defenseLimit, setDefenseLimit] = useState<string>("season");
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([]);
  const [inputMarket, setInputMarket] = useState(tip.market);
  const [inputLine, setInputLine] = useState(tip.line);
  const [inputOverUnder, setInputOverUnder] = useState(tip.selection);

  const [searchQuery, setSearchQuery] = useState(tip.player || "");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [gameTips, setGameTips] = useState<Tip[]>([]);
  const [pendingTipData, setPendingTipData] = useState<Tip | null>(null);

  const handleLeagueToggle = (league: string) => {
    setSelectedLeagues((prev) => {
      if (prev.includes(league)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== league);
      }
      return [...prev, league];
    });
  };

  const handleSearch = () => {
    const targetPlayerId = selectedPlayerId || playerId;
    const newAmount = inputLine !== undefined ? inputLine : tip.line;

    const oppTeam = pendingTipData?.opponent_team_id || tip.opponent_team_id;
    const oppName = pendingTipData?.opponent || tip.opponent;
    const teamId = pendingTipData?.team_id || tip.team_id;
    const position = pendingTipData?.position || tip.position;
    const season = tip.season;

    let newState = { ...savedState };
    if (pendingTipData) {
      const gameId = pendingTipData.id.split("_")[0];
      newState = {
        ...newState,
        player_id: pendingTipData.player_id,
        player: pendingTipData.player,
        position: position,
        team_id: teamId,
        opponent_team_id: oppTeam,
        opponent: oppName,
        game_id: gameId,
        season_code: season,
      };
    }

    navigate(
      `/player-stats/${targetPlayerId}?propType=${inputMarket}&propAmount=${isNaN(newAmount) ? tip.line : newAmount}&overUnder=${inputOverUnder}&oppTeam=${oppTeam}&oppName=${encodeURIComponent(oppName)}&teamId=${teamId}&position=${position}&season=${season}`,
      { state: newState },
    );

    setSelectedPlayerId(null);
    setPendingTipData(null);
  };

  // 5A. Fetch SEASON Stats (always runs)
  useEffect(() => {
    if (!tip.player_id) return;

    async function loadSeasonStats() {
      const data = await fetchPlayerStats(
        tip.player_id,
        0,
        undefined,
        selectedSeason, // <-- Only fetch the selected season
        undefined,
      );
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

    loadSeasonStats();
  }, [tip.player_id, tip.team_id, selectedSeason]);

  // 5B. Fetch H2H Stats (runs when opponent is available)
  useEffect(() => {
    if (!tip.player_id || !tip.opponent_team_id) return;

    async function loadH2HStats() {
      const data = await fetchPlayerStats(
        tip.player_id,
        0,
        tip.opponent_team_id,
        undefined, // <-- NO season filter! Fetches all-time H2H
        undefined,
      );
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

      setH2hStats(formatted);
    }

    loadH2HStats();
  }, [tip.player_id, tip.opponent_team_id, tip.team_id]);

  // 6. Fetch Defense Stats
  useEffect(() => {
    const opponentId: string = tip.opponent_team_id || "";
    const positionStr: string = tip.position || "";

    if (
      !opponentId ||
      !positionStr ||
      opponentId === "UNK" ||
      positionStr === "UNK"
    )
      return;

    async function loadDefense() {
      try {
        const data = await fetchDefenseRankings(
          opponentId,
          positionStr,
          defenseLimit,
        );
        setDefenseData(data);
      } catch (err) {
        console.error(err);
      }
    }

    loadDefense();
  }, [tip.opponent_team_id, tip.position, defenseLimit]);

  useEffect(() => {
    const gameId = savedState?.game_id;
    if (!gameId) return;

    async function loadGameTips(id: string) {
      try {
        const tips = await fetchTips(id);
        setGameTips(tips);
      } catch (err) {
        console.error(err);
      }
    }

    loadGameTips(gameId);
  }, [savedState?.game_id]);

  // 7. Fetch Similar Players

  useEffect(() => {
    const opponentId = tip.opponent_team_id;
    const positionStr = tip.position;
    const market = tip.market;

    if (
      !opponentId ||
      !positionStr ||
      opponentId === "UNK" ||
      positionStr === "UNK"
    )
      return;

    async function loadSimilarPlayers() {
      try {
        const data = await fetchSimilarPlayers(
          opponentId,
          positionStr,
          market,
          tip.line,
        );
        setSimilarPlayers(data);
      } catch (err) {
        console.error(err);
      }
    }

    loadSimilarPlayers();
  }, [tip.opponent_team_id, tip.position, tip.market, tip.line]);

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
    const sel = tip.selection || "over";
    if (sel === "over") {
      return value > tip.line ? "#4caf50" : "#e94560";
    }
    return value < tip.line ? "#4caf50" : "#e94560";
  };

  // 1. Filter by Venue (Home / Away / Both)

  const filterByVenue = (games: PlayerGameStat[]) => {
    if (venueFilter === "all") return games;

    return games.filter((game) => {
      // Use the player's team FOR THAT SPECIFIC GAME (handles team changes!)
      const playersTeamInThisGame = game.team_id;

      // team_id_a is usually the Home team
      const isHome = playersTeamInThisGame === game.team_id_a;

      if (venueFilter === "home") return isHome;
      if (venueFilter === "away") return !isHome;
      return true;
    });
  };

  const venueFilteredStats = filterByVenue(stats);
  const venueFilteredH2H = filterByVenue(h2hStats);

  // 2. Apply L5/L10/L15/Season/H2H on top of the venue-filtered stats
  const displayedStats =
    activeFilter === "h2h"
      ? venueFilteredH2H
      : activeFilter === "season"
        ? venueFilteredStats
        : venueFilteredStats.slice(-parseInt(activeFilter));

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.length >= 2) {
      try {
        const results = await fetchPlayerSearch(value);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelectPlayer = (player: PlayerSearchResult) => {
    setSearchQuery(player.player_name);
    setSelectedPlayerId(player.player_id);
    setShowDropdown(false);
  };

  const handleSidebarClick = (tipItem: Tip) => {
    setSearchQuery(tipItem.player);
    setSelectedPlayerId(tipItem.player_id);
    setInputMarket(tipItem.market);
    setInputLine(tipItem.line);
    setInputOverUnder(tipItem.selection || "over");
    setPendingTipData(tipItem);
  };

  return (
    <div className={styles.pageLayout}>
      {/* ==========================================
          LEFT SIDEBAR: Game Props
          ========================================== */}
      <div className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>
          {savedState?.team_id || "Team"} vs{" "}
          {savedState?.opponent_team_id || "Opp"}
        </h3>

        {gameTips.map((t) => {
          const isActive =
            t.player_id === tip.player_id && t.market === tip.market;

          return (
            <div
              key={t.id}
              className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ""}`}
              onClick={() => handleSidebarClick(t)}
            >
              <div className={styles.sidebarPlayerName}>
                {t.player}{" "}
                <span className={styles.sidebarPositionText}>
                  ({t.position})
                </span>
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

      <div className={styles.mainContent}>
        <div className={styles.container}>
          {/* Back Button & Header */}
          <button onClick={() => navigate("/")} className={styles.backButton}>
            ← Back to Dashboard
          </button>

          {/* PLAYER SEARCH BAR */}
          <div className={styles.searchBarWrapper}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search player..."
              className={styles.searchInput}
            />

            {/* Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {searchResults.map((p) => (
                  <li
                    key={p.player_id}
                    onClick={() => handleSelectPlayer(p)}
                    className={styles.searchDropdownItem}
                  >
                    <span className={styles.searchDropdownName}>
                      {p.player_name}
                    </span>
                    <span className={styles.searchDropdownInfo}>
                      {p.team_id} | {p.position}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ==========================================
          NEW: INTERACTIVE PROP TOOLBAR
          ========================================== */}
          <div className={styles.toolbar}>
            {/* Over/Under Toggle */}
            <select
              value={inputOverUnder}
              onChange={(e) =>
                setInputOverUnder(e.target.value as "over" | "under")
              }
              className={
                inputOverUnder === "over"
                  ? styles.toolbarSelectOver
                  : styles.toolbarSelectUnder
              }
            >
              <option value="over">OVER</option>
              <option value="under">UNDER</option>
            </select>

            {/* Line Input */}
            <input
              type="number"
              step="1"
              value={inputLine}
              onChange={(e) => setInputLine(parseFloat(e.target.value))}
              className={styles.toolbarLineInput}
            />

            {/* Prop Type Dropdown */}
            <select
              value={inputMarket}
              onChange={(e) => setInputMarket(e.target.value)}
              className={styles.toolbarPropSelect}
            >
              <option value="points">Points</option>
              <option value="rebounds">Rebounds</option>
              <option value="assists">Assists</option>
              <option value="threes_made">3PT Made</option>
            </select>

            {/* SEARCH BUTTON */}
            <button onClick={handleSearch} className={styles.toolbarSearchBtn}>
              🔍 Search
            </button>

            {/* Opponent Info */}
            {(tip.opponent || tip.opponent_team_id) && (
              <div className={styles.toolbarOpponentInfo}>
                vs {tip.opponent || tip.opponent_team_id} |{" "}
                {tip.position || "N/A"}
              </div>
            )}
          </div>

          <div className={styles.hitRatesContainer}>
            <HitRateBox
              label="L5"
              hr={calculateHitRate(
                venueFilteredStats
                  .slice(-5)
                  .map((s) => s[marketKey() as keyof PlayerGameStat] as number),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="L10"
              hr={calculateHitRate(
                venueFilteredStats
                  .slice(-10)
                  .map((s) => s[marketKey() as keyof PlayerGameStat] as number),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="L15"
              hr={calculateHitRate(
                venueFilteredStats
                  .slice(-15)
                  .map((s) => s[marketKey() as keyof PlayerGameStat] as number),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="Season"
              hr={calculateHitRate(
                venueFilteredStats.map(
                  (s) => s[marketKey() as keyof PlayerGameStat] as number,
                ),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label={`VS ${tip.opponent_team_id}`}
              hr={calculateHitRate(
                venueFilteredH2H.map(
                  (s) => s[marketKey() as keyof PlayerGameStat] as number,
                ),
                tip.line,
                tip.selection,
              )}
            />
          </div>

          {/* Game Filter Buttons */}
          <div className={styles.filterRow}>
            {/* LEFT SIDE: Graph Length Filters */}
            <div className={styles.filterButtons}>
              {(["5", "10", "15", "season", "h2h"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`${styles.filterButton} ${
                    activeFilter === f ? styles.filterButtonActive : ""
                  }`}
                >
                  {f === "h2h"
                    ? "H2H"
                    : f === "season"
                      ? "Season"
                      : `Last ${f}`}
                </button>
              ))}
            </div>
          </div>
          {/* MAIN CHART: Market Stats */}
          <div className={styles.chartContainer}>
            <h3 className={styles.chartTitle}>{marketLabel()} per Game</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={displayedStats}>
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
                  {displayedStats.map((entry, index) => {
                    const value = entry[
                      marketKey() as keyof PlayerGameStat
                    ] as number;
                    return (
                      <Cell key={`cell-${index}`} fill={getBarColor(value)} />
                    );
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
              <BarChart data={displayedStats}>
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
          <div className={styles.defenseFilterWrapper}>
            {["5", "10", "season"].map((f) => (
              <button
                key={f}
                onClick={() => setDefenseLimit(f)}
                className={
                  defenseLimit === f
                    ? styles.defenseFilterBtnActive
                    : styles.defenseFilterBtnInactive
                }
              >
                {f === "season" ? "Season" : `Last ${f}`}
              </button>
            ))}
          </div>

          {/* OPPONENT DEFENSE RANKINGS */}
          {defenseData &&
            defenseData.stats &&
            tip.opponent_team_id &&
            tip.position && (
              <div className={styles.defenseContainer}>
                <h3 className={styles.defenseTitle}>
                  {tip.opponent || tip.opponent_team_id} Defense vs{" "}
                  {tip.position || "All"} Position
                </h3>

                {/* TOP ROW: PTS, REB, AST */}
                <div className={styles.defenseRow}>
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
                <div className={styles.defenseRowBottom}>
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
                <div className={styles.defenseLegend}>
                  <div className={styles.defenseLegendItem}>
                    <span className={styles.defenseLegendColorGreen}></span>
                    <span>Weak = Green (Bad defense, easier to score)</span>
                  </div>
                  <div className={styles.defenseLegendItem}>
                    <span className={styles.defenseLegendColorRed}></span>
                    <span>Strong = Red (Good defense, harder to score)</span>
                  </div>
                  <div className={styles.defenseLegendItem}>
                    <span className={styles.defenseLegendColorGray}></span>
                    <span>Average = Gray</span>
                  </div>
                </div>
              </div>
            )}
          {/* SIMILAR PLAYERS PERFORMANCE */}
          {similarPlayers.length > 0 &&
            tip.opponent_team_id &&
            tip.position && (
              <div className={styles.similarPlayersContainer}>
                <h3 className={styles.similarPlayersTitle}>
                  Similar {tip.position || "Player"}s vs{" "}
                  {tip.opponent || tip.opponent_team_id} (Last 10)
                </h3>

                {similarPlayers.map((p) => {
                  const isOver =
                    parseFloat(String(p.game_stat)) >=
                    parseFloat(String(p.avg_stat));
                  const dateFormatted = new Date(p.date).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" },
                  );

                  return (
                    <div key={p.player_id} className={styles.similarPlayerRow}>
                      <div className={styles.similarPlayerInfo}>
                        <img
                          className={styles.similarPlayerTeamLogo}
                          src={`/logos/${p.team_id}.png`}
                          alt={p.team_id}
                        />
                        <span className={styles.similarPlayerName}>
                          {p.player}
                        </span>
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
            )}
        </div>
        <div className={styles.filtersColumn}>
          {/* Venue Toggle (Home / Away / Both) */}
          <h3 className={styles.filterTitle}>Home/Away</h3>
          <p className={styles.filterParagraph}>Filter stats by home or away</p>
          <div className={styles.venueToggleGroup}>
            <button
              onClick={() => setVenueFilter("all")}
              className={
                venueFilter === "all"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Both
            </button>
            <button
              onClick={() => setVenueFilter("home")}
              className={
                venueFilter === "home"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Home
            </button>
            <button
              onClick={() => setVenueFilter("away")}
              className={
                venueFilter === "away"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Away
            </button>
          </div>

          {/* SEASON FILTER */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>Season</span>
            <select
              className={styles.seasonDropdown}
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
            >
              <option value="E2025">2024/25</option>
              <option value="E2024">2023/24</option>
              <option value="E2023">2022/23</option>
            </select>
          </div>
          {/* LEAGUE FILTER */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>League</span>

            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={selectedLeagues.includes("euroleague")}
                onChange={() => handleLeagueToggle("euroleague")}
              />
              Euroleague
            </label>

            <label className={styles.checkboxItemDisabled}>
              <input type="checkbox" disabled checked={false} />
              NBA
            </label>

            <label className={styles.checkboxItemDisabled}>
              <input type="checkbox" disabled checked={false} />
              Eurocup
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
