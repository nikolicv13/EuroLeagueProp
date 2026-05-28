import { useState, useEffect, useMemo } from "react";
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

const LOG_PER_PAGE = 15;

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
  const numLine = Number(line);
  const sel = selection === "under" ? "under" : "over"; // Force strict "over" or "under"

  for (const value of values) {
    const numVal = Number(value);
    if (isNaN(numVal)) continue; // Skip if data is missing

    if (sel === "over" && numVal > numLine) hits++;
    if (sel === "under" && numVal < numLine) hits++;
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

  // 1. Get the raw market from the URL
  const rawMarket =
    searchParams.get("propType") || savedState?.market || "points";

  // 2. Normalize it: "points_alt2" becomes "points", "rebounds_alt" becomes "rebounds"
  const normalizedMarket = rawMarket.replace(/_alt\d*/g, "");
  // 2. Merge URL params with SAVED State (URL wins for prop/line/overUnder)
  const tip = {
    ...savedState,
    player_id: playerId || savedState?.player_id || "",
    market: normalizedMarket,
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
  const [phaseFilter, setPhaseFilter] = useState<
    "all" | "regular" | "playoffs"
  >("all");
  const [logPage, setLogPage] = useState(1);
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

  const [oppPlayerQuery, setOppPlayerQuery] = useState(
    searchParams.get("oppPlayerName") || "",
  );
  const [oppPlayerResults, setOppPlayerResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [showOppDropdown, setShowOppDropdown] = useState(false);
  const [selectedOppPlayer, setSelectedOppPlayer] = useState<{
    id: string;
    name: string;
  } | null>(
    searchParams.get("oppPlayerId")
      ? {
          id: searchParams.get("oppPlayerId")!,
          name: decodeURIComponent(searchParams.get("oppPlayerName") || ""),
        }
      : null,
  );

  // WITH Teammate States
  const [withQuery, setWithQuery] = useState(
    searchParams.get("withName") || "",
  );
  const [withResults, setWithResults] = useState<PlayerSearchResult[]>([]);
  const [showWithDropdown, setShowWithDropdown] = useState(false);
  const [selectedWith, setSelectedWith] = useState<{
    id: string;
    name: string;
  } | null>(
    searchParams.get("withId")
      ? {
          id: searchParams.get("withId")!,
          name: decodeURIComponent(searchParams.get("withName") || ""),
        }
      : null,
  );

  // WITHOUT Teammate States
  const [withoutQuery, setWithoutQuery] = useState(
    searchParams.get("withoutName") || "",
  );
  const [withoutResults, setWithoutResults] = useState<PlayerSearchResult[]>(
    [],
  );
  const [showWithoutDropdown, setShowWithoutDropdown] = useState(false);
  const [selectedWithout, setSelectedWithout] = useState<{
    id: string;
    name: string;
  } | null>(
    searchParams.get("withoutId")
      ? {
          id: searchParams.get("withoutId")!,
          name: decodeURIComponent(searchParams.get("withoutName") || ""),
        }
      : null,
  );

  // Generic Search Handler
  const handleTeammateSearch = async (
    type: "with" | "without",
    value: string,
  ) => {
    if (type === "with") setWithQuery(value);
    else setWithoutQuery(value);

    if (value.length >= 2) {
      try {
        const results = await fetchPlayerSearch(value);
        if (type === "with") {
          setWithResults(results);
          setShowWithDropdown(true);
        } else {
          setWithoutResults(results);
          setShowWithoutDropdown(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      if (type === "with") {
        setWithResults([]);
        setShowWithDropdown(false);
      } else {
        setWithoutResults([]);
        setShowWithoutDropdown(false);
      }
    }
  };

  // Generic Select Handler
  const handleSelectTeammate = (
    type: "with" | "without",
    player: PlayerSearchResult,
  ) => {
    const newParams = new URLSearchParams(searchParams);
    if (type === "with") {
      setSelectedWith({ id: player.player_id, name: player.player_name });
      setWithQuery(player.player_name);
      setShowWithDropdown(false);
      newParams.set("withId", player.player_id);
      newParams.set("withName", encodeURIComponent(player.player_name));
    } else {
      setSelectedWithout({ id: player.player_id, name: player.player_name });
      setWithoutQuery(player.player_name);
      setShowWithoutDropdown(false);
      newParams.set("withoutId", player.player_id);
      newParams.set("withoutName", encodeURIComponent(player.player_name));
    }
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
  };

  // Generic Clear Handler
  const clearTeammate = (type: "with" | "without") => {
    const newParams = new URLSearchParams(searchParams);
    if (type === "with") {
      setSelectedWith(null);
      setWithQuery("");
      newParams.delete("withId");
      newParams.delete("withName");
    } else {
      setSelectedWithout(null);
      setWithoutQuery("");
      newParams.delete("withoutId");
      newParams.delete("withoutName");
    }
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
  };
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

  const handleOppSearchChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setOppPlayerQuery(value);
    if (value.length >= 2) {
      try {
        const results = await fetchPlayerSearch(value);
        setOppPlayerResults(results);
        setShowOppDropdown(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      setOppPlayerResults([]);
      setShowOppDropdown(false);
    }
  };

  const handleSelectOppPlayer = (player: PlayerSearchResult) => {
    setSelectedOppPlayer({ id: player.player_id, name: player.player_name });
    setOppPlayerQuery(player.player_name);
    setShowOppDropdown(false);

    // Update URL so filter persists on refresh
    const newParams = new URLSearchParams(searchParams);
    newParams.set("oppPlayerId", player.player_id);
    newParams.set("oppPlayerName", encodeURIComponent(player.player_name));
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
  };

  const clearOppPlayer = () => {
    setSelectedOppPlayer(null);
    setOppPlayerQuery("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("oppPlayerId");
    newParams.delete("oppPlayerName");
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
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
        selectedOppPlayer?.id,
        selectedWith?.id,
        selectedWithout?.id,
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
  }, [
    tip.player_id,
    tip.team_id,
    selectedSeason,
    selectedOppPlayer?.id,
    selectedWith?.id,
    selectedWithout?.id,
  ]);

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

  const venueFilteredStats = useMemo(() => {
    if (venueFilter === "all") return stats;
    return stats.filter((game) => {
      const isHome = game.team_id === game.team_id_a;
      return venueFilter === "home" ? isHome : !isHome;
    });
  }, [stats, venueFilter]);

  const venueFilteredH2H = useMemo(() => {
    if (venueFilter === "all") return h2hStats;
    return h2hStats.filter((game) => {
      const isHome = game.team_id === game.team_id_a;
      return venueFilter === "home" ? isHome : !isHome;
    });
  }, [h2hStats, venueFilter]);

  // 2. Filter by Phase (Chained after Venue)
  const phaseAndVenueFilteredStats = useMemo(() => {
    if (phaseFilter === "all") return venueFilteredStats;
    return venueFilteredStats.filter((game) => {
      const p = game.phase?.toUpperCase() || "";
      if (phaseFilter === "regular") return p.includes("REGULAR");
      if (phaseFilter === "playoffs")
        return !p.includes("REGULAR") && p.length > 0;
      return true;
    });
  }, [venueFilteredStats, phaseFilter]);

  const phaseAndVenueFilteredH2H = useMemo(() => {
    if (phaseFilter === "all") return venueFilteredH2H;
    return venueFilteredH2H.filter((game) => {
      const p = game.phase?.toUpperCase() || "";
      if (phaseFilter === "regular") return p.includes("REGULAR");
      if (phaseFilter === "playoffs")
        return !p.includes("REGULAR") && p.length > 0;
      return true;
    });
  }, [venueFilteredH2H, phaseFilter]);

  // 1. Helper to map raw DB stats to combined stats
  const mapToChartData = (stats: PlayerGameStat[]) =>
    stats.map((game) => {
      const pts = parseFloat(String(game.points)) || 0;
      const reb = parseFloat(String(game.total_rebounds)) || 0;
      const ast = parseFloat(String(game.assists)) || 0;
      const stl = parseFloat(String(game.steals)) || 0;
      const blk = parseFloat(String(game.blocks_favour ?? game.blocks)) || 0;
      return {
        ...game,
        steals: stl,
        blocks: blk,
        pa: pts + ast,
        pr: pts + reb,
        ra: reb + ast,
        pra: pts + reb + ast,
      };
    });

  // 3. Map to Chart Data (Chained after Phase)
  const fullSeasonChartData = useMemo(
    () => mapToChartData(phaseAndVenueFilteredStats),
    [phaseAndVenueFilteredStats],
  );

  const fullH2HChartData = useMemo(
    () => mapToChartData(phaseAndVenueFilteredH2H),
    [phaseAndVenueFilteredH2H],
  );

  // 2. GRAPH DATA: Sliced based on the active filter (L5, L10, H2H, etc.)
  const displayedStats = useMemo(() => {
    const baseData =
      activeFilter === "h2h" ? fullH2HChartData : fullSeasonChartData;
    if (activeFilter === "h2h" || activeFilter === "season") return baseData;
    return baseData.slice(-parseInt(activeFilter));
  }, [activeFilter, fullSeasonChartData, fullH2HChartData]);

  const chartData = useMemo(() => displayedStats, [displayedStats]);

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
      case "points_alt":
      case "points_alt2":
        return "points";
      case "assists":
      case "assists_alt":
        return "assists";
      case "rebounds":
      case "rebounds_alt":
      case "rebounds_alt2":
        return "total_rebounds";
      case "threes_made":
        return "three_points_made";
      case "steals":
        return "steals";
      case "blocks":
        return "blocks";
      case "pa":
        return "pa";
      case "pr":
        return "pr";
      case "ra":
        return "ra";
      case "pra":
        return "pra";
      default:
        return "points";
    }
  };

  const marketLabel = () => {
    switch (tip.market) {
      case "points":
        return "Points";
      case "points_alt":
        return "Points (Alt 1)";
      case "points_alt2":
        return "Points (Alt 2)";
      case "assists":
        return "Assists";
      case "assists_alt":
        return "Assists (Alt)";
      case "rebounds":
        return "Rebounds";
      case "rebounds_alt":
        return "Rebounds (Alt 1)";
      case "rebounds_alt2":
        return "Rebounds (Alt 2)";
      case "threes_made":
        return "3PT Made";
      case "steals":
        return "Steals";
      case "blocks":
        return "Blocks";
      case "pa":
        return "Points + Assists";
      case "pr":
        return "Points + Rebounds";
      case "ra":
        return "Rebounds + Assists";
      case "pra":
        return "Points + Rebounds + Assists";
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

  // 2. Apply L5/L10/L15/Season/H2H on top of the venue-filtered stats

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

  // 2. Use the new type instead of 'any'
  const getStatValue = (s: PlayerGameStat) => {
    const key = marketKey();

    // Safely extract base stats
    const pts = Number(s.points) || 0;
    const reb = Number(s.total_rebounds) || 0;
    const ast = Number(s.assists) || 0;
    const stl = Number(s.steals) || 0;
    const blk = Number(s.blocks || s.blocks_favour) || 0;

    // Calculate combinations on the fly
    if (key === "pa") return pts + ast;
    if (key === "pr") return pts + reb;
    if (key === "ra") return reb + ast;
    if (key === "pra") return pts + reb + ast;
    if (key === "steals") return stl;
    if (key === "blocks") return blk;

    // Fallback for standard stats (points, rebounds, etc.)
    return Number(s[key as keyof PlayerGameStat]) || 0;
  };

  // Calculate Field Goal Percentage
  const getFG = (game: PlayerGameStat) => {
    const made = (game.two_points_made || 0) + (game.three_points_made || 0);
    const att =
      (game.two_points_attempted || 0) + (game.three_points_attempted || 0);
    if (att === 0) return "0.0";
    return ((made / att) * 100).toFixed(1);
  };

  // Calculate Win/Loss
  const getWL = (game: PlayerGameStat) => {
    if (game.score_a === null || game.score_b === null) return "-";
    const isHome = game.team_id === game.team_id_a;
    const teamScore = isHome ? game.score_a : game.score_b;
    const oppScore = isHome ? game.score_b : game.score_a;
    return teamScore > oppScore ? "W" : "L";
  };

  const handleVenueChange = (val: "all" | "home" | "away") => {
    setVenueFilter(val);
    setLogPage(1);
  };

  const handlePhaseChange = (val: "all" | "regular" | "playoffs") => {
    setPhaseFilter(val);
    setLogPage(1);
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
                {searchResults.map((p, index) => (
                  <li
                    key={`${p.player_id}-${p.team_id}-${index}`}
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

              <optgroup label="Combinations">
                <option value="pra">P + R + A</option>
                <option value="pa">P + A</option>
                <option value="pr">P + R</option>
                <option value="ra">R + A</option>
              </optgroup>
              <optgroup label="Defense">
                <option value="steals">Steals</option>
                <option value="blocks">Blocks</option>
              </optgroup>
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
                fullSeasonChartData.slice(-5).map(getStatValue),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="L10"
              hr={calculateHitRate(
                fullSeasonChartData.slice(-10).map(getStatValue),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="L15"
              hr={calculateHitRate(
                fullSeasonChartData.slice(-15).map(getStatValue),
                tip.line,
                tip.selection,
              )}
            />
            <HitRateBox
              label="Season"
              hr={calculateHitRate(
                fullSeasonChartData.map(getStatValue),
                tip.line,
                tip.selection,
              )}
            />
            {!selectedOppPlayer && (
              <HitRateBox
                label={`VS ${tip.opponent_team_id}`}
                hr={calculateHitRate(
                  fullH2HChartData.map(getStatValue),
                  tip.line,
                  tip.selection,
                )}
              />
            )}
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
                  {chartData.map((entry, index) => {
                    // 👈 CHANGED TO chartData
                    const value = entry[
                      marketKey() as keyof typeof entry
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
          {/* ==========================================
              GAME LOG TABLE
              ========================================== */}
          <div className={styles.gameLogContainer}>
            <h3 className={styles.gameLogTitle}>
              Game Log ({selectedSeason})
              {phaseFilter !== "all" &&
                ` - ${phaseFilter === "regular" ? "Regular Season" : "Playoffs"}`}
              {venueFilter !== "all" &&
                ` (${venueFilter === "home" ? "Home" : "Away"})`}
            </h3>

            <div className={styles.tableWrapper}>
              <table className={styles.gameLogTable}>
                <thead>
                  <tr>
                    <th>R</th>
                    <th>DATE</th>
                    <th>OPP</th>
                    <th>H/A</th>
                    <th>W/L</th>
                    <th>MIN</th>
                    <th>PTS</th>
                    <th>FT</th>
                    <th>2PT</th>
                    <th>3PT</th>
                    <th>FG%</th>
                    <th>REB</th>
                    <th>OR</th>
                    <th>DR</th>
                    <th>AST</th>
                    <th>STL</th>
                    <th>BLK</th>
                    <th>TO</th>
                    <th>FC</th>
                    <th>FD</th>
                    <th>+/-</th>
                    <th>PIR</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Create a reversed copy just for the table so newest is at the top */}
                  {[...fullSeasonChartData]
                    .reverse()
                    .slice((logPage - 1) * LOG_PER_PAGE, logPage * LOG_PER_PAGE)
                    .map((game) => {
                      const isHome = game.team_id === game.team_id_a;
                      const oppAbbr = isHome ? game.team_id_b : game.team_id_a;
                      const wl = getWL(game);

                      return (
                        <tr
                          key={game.game_id}
                          className={wl === "L" ? styles.lossRow : ""}
                        >
                          <td>{game.round || "-"}</td>
                          <td>{formatDate(game.date)}</td>
                          <td className={styles.oppCell}>
                            <img
                              src={`/logos/${oppAbbr}.png`}
                              alt={oppAbbr}
                              className={styles.logLogo}
                            />
                            {oppAbbr}
                          </td>
                          <td>{isHome ? "H" : "A"}</td>
                          <td
                            className={
                              wl === "W"
                                ? styles.winText
                                : wl === "L"
                                  ? styles.lossText
                                  : ""
                            }
                          >
                            {wl}
                          </td>
                          <td>{game.minutes}</td>
                          <td className={styles.statCell}>{game.points}</td>
                          <td>
                            {game.free_throws_made}/{game.free_throws_attempted}
                          </td>
                          <td>
                            {game.two_points_made}/{game.two_points_attempted}
                          </td>
                          <td>
                            {game.three_points_made}/
                            {game.three_points_attempted}
                          </td>
                          <td>{getFG(game)}%</td>
                          <td className={styles.statCell}>
                            {game.total_rebounds}
                          </td>
                          <td>{game.offensive_rebounds}</td>
                          <td>{game.defensive_rebounds}</td>
                          <td className={styles.statCell}>{game.assists}</td>
                          <td>{game.steals}</td>
                          <td>{game.blocks || game.blocks_favour}</td>
                          <td>{game.turnovers}</td>
                          <td>{game.fouls_committed}</td>
                          <td>{game.fouls_received}</td>
                          <td
                            className={
                              game.plus_minus > 0
                                ? styles.winText
                                : game.plus_minus < 0
                                  ? styles.lossText
                                  : ""
                            }
                          >
                            {game.plus_minus > 0 ? "+" : ""}
                            {game.plus_minus}
                          </td>
                          <td className={styles.pirCell}>{game.pir}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Game Log Pagination */}
            <div className={styles.logPagination}>
              <button
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={logPage === 1}
                className={styles.logPageBtn}
              >
                ← Prev 15
              </button>
              <span className={styles.logPageInfo}>
                Page {logPage} of{" "}
                {Math.ceil(fullSeasonChartData.length / LOG_PER_PAGE)}
              </span>
              <button
                onClick={() => setLogPage((p) => p + 1)}
                disabled={logPage * LOG_PER_PAGE >= fullSeasonChartData.length}
                className={styles.logPageBtn}
              >
                Next 15 →
              </button>
            </div>
          </div>
        </div>
        <div className={styles.filtersColumn}>
          {/* Venue Toggle (Home / Away / Both) */}
          <h3 className={styles.filterTitle}>Home/Away</h3>
          <p className={styles.filterParagraph}>Filter stats by home or away</p>
          <div className={styles.venueToggleGroup}>
            <button
              onClick={() => handleVenueChange("all")}
              className={
                venueFilter === "all"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Both
            </button>
            <button
              onClick={() => handleVenueChange("home")}
              className={
                venueFilter === "home"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Home
            </button>
            <button
              onClick={() => handleVenueChange("away")}
              className={
                venueFilter === "away"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Away
            </button>
          </div>
          {/* 👇 NEW: PHASE TOGGLE (Regular / Playoffs) 👇 */}
          <h3 className={styles.filterTitle} style={{ marginTop: "24px" }}>
            Phase
          </h3>
          <p className={styles.filterParagraph}>
            Filter by Regular Season or Playoffs
          </p>
          <div className={styles.venueToggleGroup}>
            <button
              onClick={() => handlePhaseChange("all")}
              className={
                phaseFilter === "all"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              All
            </button>
            <button
              onClick={() => handlePhaseChange("regular")}
              className={
                phaseFilter === "regular"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Regular
            </button>
            <button
              onClick={() => handlePhaseChange("playoffs")}
              className={
                phaseFilter === "playoffs"
                  ? styles.venueToggleButtonActive
                  : styles.venueToggleButton
              }
            >
              Playoffs
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
              <option value="E2025">2025/26</option>
              <option value="E2024">2024/25</option>
              <option value="E2023">2023/24</option>
            </select>
          </div>
          {/* 👇 NEW: OPPOSING PLAYER MATCHUP FILTER 👇 */}
          <div
            className={styles.searchBarWrapper}
            style={{ marginTop: "10px" }}
          >
            <div style={{ position: "relative", display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={oppPlayerQuery}
                onChange={handleOppSearchChange}
                onBlur={() => setTimeout(() => setShowOppDropdown(false), 200)}
                onFocus={() =>
                  oppPlayerResults.length > 0 && setShowOppDropdown(true)
                }
                placeholder="Filter by opposing player..."
                className={`${styles.searchInput} ${selectedOppPlayer ? styles.searchInputActive : ""}`}
                style={{ flex: 1 }}
              />
              {selectedOppPlayer && (
                <button
                  onClick={clearOppPlayer}
                  className={styles.clearOppBtn}
                  title="Clear matchup filter"
                >
                  ✕
                </button>
              )}
            </div>

            {showOppDropdown && oppPlayerResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {oppPlayerResults.map((p, index) => (
                  <li
                    key={`${p.player_id}-${p.team_id}-${index}`}
                    onClick={() => handleSelectOppPlayer(p)}
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
            {selectedOppPlayer && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#e94560",
                  fontWeight: "bold",
                  marginTop: "5px",
                }}
              >
                ⚔️ Showing games vs {selectedOppPlayer.name}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            {/* 1. WITH TEAMMATE (Green) */}
            <div className={styles.searchBarWrapper}>
              <label
                className={styles.filterLabel}
                style={{
                  color: "#4caf50",
                  marginBottom: "5px",
                  display: "block",
                }}
              >
                🤝 With Teammate
              </label>
              <div
                style={{ position: "relative", display: "flex", gap: "8px" }}
              >
                <input
                  type="text"
                  value={withQuery}
                  onChange={(e) => handleTeammateSearch("with", e.target.value)}
                  onBlur={() =>
                    setTimeout(() => setShowWithDropdown(false), 200)
                  }
                  onFocus={() =>
                    withResults.length > 0 && setShowWithDropdown(true)
                  }
                  placeholder="Search teammate..."
                  className={`${styles.searchInput} ${selectedWith ? styles.searchInputActiveWith : ""}`}
                  style={{ flex: 1 }}
                />
                {selectedWith && (
                  <button
                    onClick={() => clearTeammate("with")}
                    className={styles.clearWithBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
              {showWithDropdown && withResults.length > 0 && (
                <ul className={styles.searchDropdown}>
                  {withResults.map((p, i) => (
                    <li
                      key={`${p.player_id}-${i}`}
                      onMouseDown={() => handleSelectTeammate("with", p)}
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
              {selectedWith && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#4caf50",
                    fontWeight: "bold",
                    marginTop: "4px",
                  }}
                >
                  Showing games WITH {selectedWith.name}
                </p>
              )}
            </div>

            {/* 2. WITHOUT TEAMMATE (Red) */}
            <div className={styles.searchBarWrapper}>
              <label
                className={styles.filterLabel}
                style={{
                  color: "#e94560",
                  marginBottom: "5px",
                  display: "block",
                }}
              >
                🚑 Without Teammate
              </label>
              <div
                style={{ position: "relative", display: "flex", gap: "8px" }}
              >
                <input
                  type="text"
                  value={withoutQuery}
                  onChange={(e) =>
                    handleTeammateSearch("without", e.target.value)
                  }
                  onBlur={() =>
                    setTimeout(() => setShowWithoutDropdown(false), 200)
                  }
                  onFocus={() =>
                    withoutResults.length > 0 && setShowWithoutDropdown(true)
                  }
                  placeholder="Search teammate..."
                  className={`${styles.searchInput} ${selectedWithout ? styles.searchInputActiveWithout : ""}`}
                  style={{ flex: 1 }}
                />
                {selectedWithout && (
                  <button
                    onClick={() => clearTeammate("without")}
                    className={styles.clearWithoutBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
              {showWithoutDropdown && withoutResults.length > 0 && (
                <ul className={styles.searchDropdown}>
                  {withoutResults.map((p, i) => (
                    <li
                      key={`${p.player_id}-${i}`}
                      onMouseDown={() => handleSelectTeammate("without", p)}
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
              {selectedWithout && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#e94560",
                    fontWeight: "bold",
                    marginTop: "4px",
                  }}
                >
                  Showing games WITHOUT {selectedWithout.name}
                </p>
              )}
            </div>
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
