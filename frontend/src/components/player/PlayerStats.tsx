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
  fetchSimilarPlayers,
  fetchBrazilBetOdds,
} from "../../api/api";
import type {
  PlayerGameStat,
  DefenseRankings,
  SimilarPlayer,
  PlayerSearchResult,
  Tip,
  LocationState,
  CurrentTip,
  ChartDataPoint,
} from "../../api/types";
import { parseMinutes, formatDate } from "./utils/playerHelpers";

import PlayerToolbar from "./PlayerToolbar";
import PlayerCharts from "./PlayerCharts";
import DefenseSection from "./DefenseSection";
import SimilarPlayersSection from "./SimilarPlayersSection";
import GameLogTable from "./GameLogTable";
import PlayerSidebar from "./PlayerSidebar";
import PlayerHeader, { type SeasonAverages } from "./PlayerHeader";
import styles from "./PlayerStats.module.css";
import GamePropsSidebar, { type GroupedProp } from "./GamePropsSidebar";

export default function PlayerStats() {
  const location = useLocation();
  const navigate = useNavigate();
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const [savedState] = useState<LocationState | null>(
    location.state as LocationState | null,
  );

  const getParam = (key: string, fallback: string) => {
    const val = searchParams.get(key);
    return val && val !== "null" ? val : fallback;
  };

  const rawMarket =
    searchParams.get("propType") || savedState?.market || "points";
  const normalizedMarket = rawMarket.replace(/_alt\d*/g, "");

  const tip: CurrentTip = {
    player_id: playerId || savedState?.player_id || "",
    player: getParam("playerName", "")
      ? decodeURIComponent(getParam("playerName", ""))
      : savedState?.player || "",
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
    game_id: savedState?.game_id,
  };

  // --- STATES ---
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
  const [inputLeague, setInputLeague] = useState(
    searchParams.get("leagueId") || "631799",
  );
  const [allLeagueOdds, setAllLeagueOdds] = useState<Tip[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(
    tip.game_id || "",
  );
  const [sidebarPropFilter, setSidebarPropFilter] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState(tip.player || "");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  // --- HANDLERS ---
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
    setSelectedLeagues((prev) =>
      prev.includes(league)
        ? prev.length === 1
          ? prev
          : prev.filter((l) => l !== league)
        : [...prev, league],
    );
  };

  const handleSearch = async () => {
    const targetPlayerId = selectedPlayerId || playerId;
    const newAmount = inputLine !== undefined ? inputLine : tip.line;
    let newPlayerName = searchQuery || tip.player || "Unknown Player";
    let oppTeam = tip.opponent_team_id;
    let oppName = tip.opponent;
    let teamId = tip.team_id;
    let position = tip.position;
    const season = tip.season;

    if (selectedPlayerId && selectedPlayerId !== playerId) {
      const searchedPlayer = searchResults.find(
        (p: PlayerSearchResult) => p.player_id === selectedPlayerId,
      );
      if (searchedPlayer) newPlayerName = searchedPlayer.player_name;
      try {
        const allOdds = await fetchBrazilBetOdds(inputLeague);
        const liveTip = allOdds.find(
          (t: Tip) => t.player_id === selectedPlayerId,
        );
        if (liveTip) {
          teamId = liveTip.team_id || "";
          position = liveTip.position || "";
          oppTeam = liveTip.opponent_team_id || "";
          oppName = liveTip.opponent || "";
        } else if (searchedPlayer) {
          teamId = searchedPlayer.team_id;
          position = searchedPlayer.position;
          oppTeam = "";
          oppName = "";
        }
      } catch {
        if (searchedPlayer) {
          teamId = searchedPlayer.team_id;
          position = searchedPlayer.position;
        }
        oppTeam = "";
        oppName = "";
      }
    } else if (pendingTipData) {
      oppTeam = pendingTipData.opponent_team_id || "";
      oppName = pendingTipData.opponent || "";
      teamId = pendingTipData.team_id || "";
      position = pendingTipData.position || "";
      newPlayerName = pendingTipData.player;
    }

    const newParams = new URLSearchParams();
    newParams.set("playerName", encodeURIComponent(newPlayerName));
    newParams.set("leagueId", inputLeague);
    newParams.set("propType", inputMarket);
    newParams.set(
      "propAmount",
      isNaN(newAmount as number) ? String(tip.line) : String(newAmount),
    );
    newParams.set("overUnder", inputOverUnder);
    if (oppTeam) newParams.set("oppTeam", oppTeam);
    if (oppName) newParams.set("oppName", encodeURIComponent(oppName));
    if (teamId) newParams.set("teamId", teamId);
    if (position) newParams.set("position", position);
    newParams.set("season", season);

    if (!selectedPlayerId || selectedPlayerId === playerId) {
      if (searchParams.get("oppPlayerId"))
        newParams.set("oppPlayerId", searchParams.get("oppPlayerId")!);
      if (searchParams.get("oppPlayerName"))
        newParams.set("oppPlayerName", searchParams.get("oppPlayerName")!);
      if (searchParams.get("withId"))
        newParams.set("withId", searchParams.get("withId")!);
      if (searchParams.get("withName"))
        newParams.set("withName", searchParams.get("withName")!);
      if (searchParams.get("withoutId"))
        newParams.set("withoutId", searchParams.get("withoutId")!);
      if (searchParams.get("withoutName"))
        newParams.set("withoutName", searchParams.get("withoutName")!);
    }

    navigate(`/player-stats/${targetPlayerId}?${newParams.toString()}`, {
      state: {
        player_id: targetPlayerId,
        player: newPlayerName,
        position,
        market: inputMarket,
        line: newAmount,
        selection: inputOverUnder,
        opponent_team_id: oppTeam,
        opponent: oppName,
        team_id: teamId,
        season_code: season,
      },
    });
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
        setOppPlayerResults(await fetchPlayerSearch(value));
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

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length >= 2) {
      try {
        setSearchResults(await fetchPlayerSearch(value));
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
  const handleVenueChange = (val: "all" | "home" | "away") => {
    setVenueFilter(val);
    setLogPage(1);
  };
  const handlePhaseChange = (val: "all" | "regular" | "playoffs") => {
    setPhaseFilter(val);
    setLogPage(1);
  };

  const resetPlayerFilters = () => {
    setVenueFilter("all");
    setPhaseFilter("all");
    setActiveFilter("10");
    setSelectedOppPlayer(null);
    setOppPlayerQuery("");
    setSelectedWith(null);
    setWithQuery("");
    setSelectedWithout(null);
    setWithoutQuery("");
    const newParams = new URLSearchParams();
    newParams.set("propType", tip.market);
    newParams.set("propAmount", String(tip.line));
    newParams.set("overUnder", tip.selection);
    newParams.set("oppTeam", tip.opponent_team_id);
    newParams.set("oppName", tip.opponent || "");
    newParams.set("teamId", tip.team_id);
    newParams.set("position", tip.position || "");
    newParams.set("season", tip.season);
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (!tip.player_id) return;
    (async () => {
      const data = await fetchPlayerStats(
        tip.player_id,
        0,
        undefined,
        selectedSeason,
        undefined,
        selectedOppPlayer?.id,
        selectedWith?.id,
        selectedWithout?.id,
      );
      setStats(
        data.reverse().map((game) => {
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
        }),
      );
    })();
  }, [
    tip.player_id,
    tip.team_id,
    selectedSeason,
    selectedOppPlayer?.id,
    selectedWith?.id,
    selectedWithout?.id,
  ]);

  useEffect(() => {
    if (!tip.player_id || !tip.opponent_team_id) return;
    (async () => {
      const data = await fetchPlayerStats(
        tip.player_id,
        0,
        tip.opponent_team_id,
        undefined,
        undefined,
      );
      setH2hStats(
        data.reverse().map((game) => {
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
        }),
      );
    })();
  }, [tip.player_id, tip.opponent_team_id, tip.team_id]);

  useEffect(() => {
    if (
      !tip.opponent_team_id ||
      !tip.position ||
      tip.opponent_team_id === "UNK" ||
      tip.position === "UNK"
    )
      return;
    (async () => {
      try {
        setDefenseData(
          await fetchDefenseRankings(
            tip.opponent_team_id,
            tip.position,
            defenseLimit,
          ),
        );
      } catch (err) {
        console.error(err);
      }
    })();
  }, [tip.opponent_team_id, tip.position, defenseLimit]);

  useEffect(() => {
    const leagueId = searchParams.get("leagueId") || "631799";
    async function loadLiveOdds() {
      try {
        const allOdds = await fetchBrazilBetOdds(leagueId);
        setAllLeagueOdds(allOdds);
        // Default to first game if none selected
        if (!selectedGameId && allOdds.length > 0) {
          setSelectedGameId(allOdds[0].game_id);
        }
      } catch (err) {
        console.error("Failed to load live odds:", err);
      }
    }
    loadLiveOdds();
  }, [searchParams, selectedGameId]);

  useEffect(() => {
    // If we already have an opponent, or don't have a player, do nothing
    if (!tip.player_id || tip.opponent_team_id) return;

    // Wait for the league odds to load
    if (allLeagueOdds.length === 0) return;

    // Find the current player in the live odds
    const liveTip = allLeagueOdds.find((t) => t.player_id === tip.player_id);

    // If we found them, and they have an opponent, patch the URL!
    if (liveTip && liveTip.opponent_team_id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("oppTeam", liveTip.opponent_team_id);
      newParams.set("oppName", encodeURIComponent(liveTip.opponent || ""));
      if (liveTip.team_id) newParams.set("teamId", liveTip.team_id);
      if (liveTip.position) newParams.set("position", liveTip.position);

      // Use replace: true so it doesn't break the browser "Back" button
      navigate(`${location.pathname}?${newParams.toString()}`, {
        replace: true,
      });
    }
  }, [
    allLeagueOdds,
    tip.player_id,
    tip.opponent_team_id,
    location.pathname,
    navigate,
    searchParams,
  ]);

  useEffect(() => {
    if (
      !tip.opponent_team_id ||
      !tip.position ||
      tip.opponent_team_id === "UNK" ||
      tip.position === "UNK"
    )
      return;
    (async () => {
      try {
        setSimilarPlayers(
          await fetchSimilarPlayers(
            tip.opponent_team_id,
            tip.position,
            tip.market,
            tip.line,
          ),
        );
      } catch (err) {
        console.error(err);
      }
    })();
  }, [tip.opponent_team_id, tip.position, tip.market, tip.line]);

  // --- MEMOIZED DATA ---
  const venueFilteredStats = useMemo(
    () =>
      venueFilter === "all"
        ? stats
        : stats.filter((game) =>
            venueFilter === "home"
              ? game.team_id === game.team_id_a
              : game.team_id !== game.team_id_a,
          ),
    [stats, venueFilter],
  );
  const venueFilteredH2H = useMemo(
    () =>
      venueFilter === "all"
        ? h2hStats
        : h2hStats.filter((game) =>
            venueFilter === "home"
              ? game.team_id === game.team_id_a
              : game.team_id !== game.team_id_a,
          ),
    [h2hStats, venueFilter],
  );
  const phaseAndVenueFilteredStats = useMemo(
    () =>
      phaseFilter === "all"
        ? venueFilteredStats
        : venueFilteredStats.filter((game) =>
            phaseFilter === "regular"
              ? (game.phase?.toUpperCase() || "").includes("REGULAR")
              : !(game.phase?.toUpperCase() || "").includes("REGULAR") &&
                (game.phase?.length || 0) > 0,
          ),
    [venueFilteredStats, phaseFilter],
  );
  const phaseAndVenueFilteredH2H = useMemo(
    () =>
      phaseFilter === "all"
        ? venueFilteredH2H
        : venueFilteredH2H.filter((game) =>
            phaseFilter === "regular"
              ? (game.phase?.toUpperCase() || "").includes("REGULAR")
              : !(game.phase?.toUpperCase() || "").includes("REGULAR") &&
                (game.phase?.length || 0) > 0,
          ),
    [venueFilteredH2H, phaseFilter],
  );

  // 1. Get unique games for the dropdown
  const availableGames = useMemo(() => {
    const map = new Map<string, Tip>();
    allLeagueOdds.forEach((t) => {
      if (!map.has(t.game_id)) map.set(t.game_id, t);
    });
    return Array.from(map.values());
  }, [allLeagueOdds]);

  // 2. Group Over/Under odds together
  const groupedSidebarTips = useMemo(() => {
    const filtered = allLeagueOdds.filter((t) => {
      const normalizedMarket = t.market.replace(/_alt\d*/g, "");

      return (
        t.game_id === selectedGameId &&
        (sidebarPropFilter === "all" || normalizedMarket === sidebarPropFilter)
      );
    });

    const groups: Record<string, GroupedProp> = {};

    filtered.forEach((tip) => {
      const key = `${tip.player_id}-${tip.market}-${tip.line}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          player: tip.player,
          player_id: tip.player_id,
          market: tip.market,
          line: tip.line,
          // 👇 Read directly from the JSON object
          overOdds:
            tip.overOdds || (tip.selection === "over" ? tip.odds : undefined),
          underOdds:
            tip.underOdds || (tip.selection === "under" ? tip.odds : undefined),
          tip: tip, // Keep a reference to the original object
        };
      } else {
        // Fallback if API sends two separate objects for the same line
        if (tip.overOdds) groups[key].overOdds = tip.overOdds;
        if (tip.underOdds) groups[key].underOdds = tip.underOdds;
      }
    });
    return Object.values(groups);
  }, [allLeagueOdds, selectedGameId, sidebarPropFilter]);

  const mapToChartData = (s: PlayerGameStat[]): ChartDataPoint[] =>
    s.map((game) => ({
      ...game,
      steals: Number(game.steals) || 0,
      blocks: Number(game.blocks_favour ?? game.blocks) || 0,
      pa: (Number(game.points) || 0) + (Number(game.assists) || 0),
      pr: (Number(game.points) || 0) + (Number(game.total_rebounds) || 0),
      ra: (Number(game.total_rebounds) || 0) + (Number(game.assists) || 0),
      pra:
        (Number(game.points) || 0) +
        (Number(game.total_rebounds) || 0) +
        (Number(game.assists) || 0),
    })) as ChartDataPoint[]; // Cast needed because we are adding new keys dynamically

  const fullSeasonChartData = useMemo(
    () => mapToChartData(phaseAndVenueFilteredStats),
    [phaseAndVenueFilteredStats],
  );
  const fullH2HChartData = useMemo(
    () => mapToChartData(phaseAndVenueFilteredH2H),
    [phaseAndVenueFilteredH2H],
  );
  const displayedStats = useMemo(() => {
    const base =
      activeFilter === "h2h" ? fullH2HChartData : fullSeasonChartData;
    return activeFilter === "h2h" || activeFilter === "season"
      ? base
      : base.slice(-parseInt(activeFilter));
  }, [activeFilter, fullSeasonChartData, fullH2HChartData]);
  const chartData = useMemo(() => displayedStats, [displayedStats]);

  const seasonAverages = useMemo<SeasonAverages | null>(() => {
    if (fullSeasonChartData.length === 0) return null;
    const len = fullSeasonChartData.length;
    return {
      pts:
        fullSeasonChartData.reduce(
          (sum, g) => sum + (Number(g.points) || 0),
          0,
        ) / len,
      reb:
        fullSeasonChartData.reduce(
          (sum, g) => sum + (Number(g.total_rebounds) || 0),
          0,
        ) / len,
      ast:
        fullSeasonChartData.reduce(
          (sum, g) => sum + (Number(g.assists) || 0),
          0,
        ) / len,
    };
  }, [fullSeasonChartData]);

  // 2. Generate dynamic title based on Venue & Phase filters
  const averagesTitle = useMemo(() => {
    const parts: string[] = [];
    if (venueFilter !== "all")
      parts.push(venueFilter === "home" ? "Home" : "Away");
    if (phaseFilter !== "all")
      parts.push(phaseFilter === "playoffs" ? "Playoffs" : "Regular Season");

    if (parts.length === 0) return "Regular Season Averages";
    return `${parts.join(" ")} Averages`;
  }, [venueFilter, phaseFilter]);

  if (!tip)
    return (
      <div className={styles.noData}>
        <p>No player data provided.</p>
        <button onClick={() => navigate("/")}>Go Back</button>
      </div>
    );

  // --- RENDER ---
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageLayout}>
        <GamePropsSidebar
          availableGames={availableGames}
          selectedGameId={selectedGameId}
          setSelectedGameId={setSelectedGameId}
          propFilter={sidebarPropFilter}
          setPropFilter={setSidebarPropFilter}
          groupedTips={groupedSidebarTips}
          currentTip={tip}
          onTipClick={handleSidebarClick}
        />
        <div className={styles.mainContent}>
          <PlayerToolbar
            searchQuery={searchQuery}
            handleSearchChange={handleSearchChange}
            searchResults={searchResults}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            handleSelectPlayer={handleSelectPlayer}
            inputOverUnder={inputOverUnder}
            inputLeague={inputLeague}
            setInputLeague={setInputLeague}
            setInputOverUnder={setInputOverUnder}
            inputLine={inputLine}
            setInputLine={setInputLine}
            inputMarket={inputMarket}
            setInputMarket={setInputMarket}
            handleSearch={handleSearch}
            tip={tip}
          />

          <PlayerHeader
            playerName={tip.player || "Unknown Player"}
            teamId={tip.team_id}
            teamAbbr={tip.team_id}
            position={tip.position}
            opponent={tip.opponent}
            opponentTeamId={tip.opponent_team_id}
            selection={tip.selection}
            line={tip.line}
            market={tip.market}
            averages={seasonAverages}
            averagesTitle={averagesTitle}
          />
          <PlayerCharts
            chartData={chartData}
            displayedStats={displayedStats}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            activeMetric={activeMetric}
            setActiveMetric={setActiveMetric}
            tip={tip}
            fullSeasonChartData={fullSeasonChartData}
            fullH2HChartData={fullH2HChartData}
            selectedOppPlayer={selectedOppPlayer}
          />
          <div className={styles.splitRow}>
            <DefenseSection
              defenseData={defenseData}
              defenseLimit={defenseLimit}
              setDefenseLimit={setDefenseLimit}
              tip={tip}
            />
            <SimilarPlayersSection similarPlayers={similarPlayers} tip={tip} />
          </div>
          <GameLogTable
            fullSeasonChartData={fullSeasonChartData}
            logPage={logPage}
            setLogPage={setLogPage}
            selectedSeason={selectedSeason}
            phaseFilter={phaseFilter}
            venueFilter={venueFilter}
          />
        </div>
        <PlayerSidebar
          venueFilter={venueFilter}
          handleVenueChange={handleVenueChange}
          phaseFilter={phaseFilter}
          handlePhaseChange={handlePhaseChange}
          selectedSeason={selectedSeason}
          setSelectedSeason={setSelectedSeason}
          oppPlayerQuery={oppPlayerQuery}
          handleOppSearchChange={handleOppSearchChange}
          oppPlayerResults={oppPlayerResults}
          showOppDropdown={showOppDropdown}
          setShowOppDropdown={setShowOppDropdown}
          selectedOppPlayer={selectedOppPlayer}
          handleSelectOppPlayer={handleSelectOppPlayer}
          clearOppPlayer={clearOppPlayer}
          withQuery={withQuery}
          handleTeammateSearch={handleTeammateSearch}
          withResults={withResults}
          showWithDropdown={showWithDropdown}
          setShowWithDropdown={setShowWithDropdown}
          selectedWith={selectedWith}
          handleSelectTeammate={handleSelectTeammate}
          clearTeammate={clearTeammate}
          withoutQuery={withoutQuery}
          withoutResults={withoutResults}
          showWithoutDropdown={showWithoutDropdown}
          setShowWithoutDropdown={setShowWithoutDropdown}
          selectedWithout={selectedWithout}
          selectedLeagues={selectedLeagues}
          handleLeagueToggle={handleLeagueToggle}
          resetPlayerFilters={resetPlayerFilters}
        />
      </div>
    </div>
  );
}
