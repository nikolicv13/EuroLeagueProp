import { useState, useEffect, useMemo, useRef } from "react";
import type { Game, Tip, PlayerSearchResult, JsonGame } from "../../api/types";
import {
  fetchGames,
  fetchTips,
  fetchBrazilBetOdds,
  fetchPlayerSearch,
} from "../../api/api";
import DashboardSidebar from "./DashboardSidebar";
import TipsList from "./TipsList";
import styles from "./TipsDashboard.module.css";

export default function TipsDashboard() {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<"odds" | "db">("odds");
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);

  const [oddsLeagueId, setOddsLeagueId] = useState("631799");
  const [jsonGames, setJsonGames] = useState<JsonGame[]>([]);
  const [jsonTeams, setJsonTeams] = useState<string[]>([]);
  const [selectedJsonGameId, setSelectedJsonGameId] = useState<string>("all");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [selectedPlayerFilter, setSelectedPlayerFilter] =
    useState<PlayerSearchResult | null>(null);
  const [selectedPropFilter, setSelectedPropFilter] = useState<string>("all");
  const [minOdds, setMinOdds] = useState(1.0);
  const [maxOdds, setMaxOdds] = useState(10.0);

  const TIPS_PER_PAGE = 10;
  const testDate = "2026-05-24";
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- HANDLERS ---
  const handlePlayerSearchChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setPlayerSearchQuery(value);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length >= 2) {
      // Set new timer
      debounceTimer.current = setTimeout(async () => {
        try {
          const results = await fetchPlayerSearch(value);
          setPlayerSearchResults(results);
          setShowPlayerDropdown(true);
        } catch (err) {
          console.error(err);
        }
      }, 300);
    } else {
      setPlayerSearchResults([]);
      setShowPlayerDropdown(false);
    }
  };
  const handleSelectPlayer = (player: PlayerSearchResult) => {
    setSelectedPlayerFilter(player);
    setPlayerSearchQuery(player.player_name);
    setShowPlayerDropdown(false);
    setCurrentPage(1);
  };

  const clearPlayerFilter = () => {
    setSelectedPlayerFilter(null);
    setPlayerSearchQuery("");
    setCurrentPage(1);
  };

  const handleMinOddsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinOdds(Math.min(Number(e.target.value), maxOdds - 0.05));
    setCurrentPage(1);
  };

  const handleMaxOddsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxOdds(Math.max(Number(e.target.value), minOdds + 0.05));
    setCurrentPage(1);
  };

  const resetDashboardFilters = () => {
    setSelectedJsonGameId("all");
    setSelectedTeamFilter("all");
    setSelectedPlayerFilter(null);
    setPlayerSearchQuery("");
    setSelectedPropFilter("all");
    setMinOdds(1.0);
    setMaxOdds(10.0);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= Math.ceil(tips.length / TIPS_PER_PAGE)) {
      // Using rough total for bounds check
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // --- EFFECTS ---

  //Fetches the list of games for a specific date (testDate)
  useEffect(() => {
    async function loadGames() {
      try {
        const data = await fetchGames(testDate);
        setGames(data);
        if (data.length > 0 && !selectedGameId)
          setSelectedGameId(data[0].game_id);
      } catch (err) {
        console.error(err);
      }
    }
    loadGames();
  }, [selectedGameId]);

  // Fetches the actual tips/odds data based on the current view mode.
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setTips([]);
      setCurrentPage(1);
      try {
        if (viewMode === "odds" && oddsLeagueId) {
          const data = await fetchBrazilBetOdds(oddsLeagueId);
          setTips(data);
          const uniqueGamesMap = new Map<string, JsonGame>();
          const uniqueTeamsSet = new Set<string>();
          data.forEach((tip: Tip) => {
            const tAbbr = tip.team_abbr || tip.team_id || tip.team || "UNK";
            const oAbbr =
              tip.opponent_abbr ||
              tip.opponent_team_id ||
              tip.opponent ||
              "UNK";
            if (!uniqueGamesMap.has(tip.game_id))
              uniqueGamesMap.set(tip.game_id, {
                game_id: tip.game_id,
                team: tAbbr,
                opponent: oAbbr,
              });
            uniqueTeamsSet.add(tAbbr);
            uniqueTeamsSet.add(oAbbr);
          });
          setJsonGames(Array.from(uniqueGamesMap.values()));
          setJsonTeams(Array.from(uniqueTeamsSet).sort());
          setSelectedJsonGameId("all");
          setSelectedTeamFilter("all");
        } else if (viewMode === "db" && selectedGameId) {
          const data = await fetchTips(selectedGameId);
          setTips(data);
        }
      } catch (err) {
        console.error("Failed to load tips:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [viewMode, selectedGameId, oddsLeagueId]);

  // --- MEMOIZED DATA ---
  const getMarketGroup = (market: string) => {
    if (market.startsWith("points")) return "points";
    if (market.startsWith("rebounds")) return "rebounds";
    if (market.startsWith("assists")) return "assists";
    return market;
  };

  const { paginatedTips, totalPages } = useMemo(() => {
    let filtered = tips;
    if (viewMode === "odds") {
      if (selectedJsonGameId !== "all")
        filtered = filtered.filter((t) => t.game_id === selectedJsonGameId);
      if (selectedTeamFilter !== "all")
        filtered = filtered.filter(
          (t) => (t.team_abbr || t.team_id) === selectedTeamFilter,
        );
      if (selectedPlayerFilter)
        filtered = filtered.filter(
          (t) => t.player_id === selectedPlayerFilter.player_id,
        );
      if (selectedPropFilter !== "all")
        filtered = filtered.filter(
          (t) => getMarketGroup(t.market) === selectedPropFilter,
        );
      filtered = filtered.filter((t) => t.odds >= minOdds && t.odds <= maxOdds);
    }
    const total = Math.ceil(filtered.length / TIPS_PER_PAGE);
    const startIndex = (currentPage - 1) * TIPS_PER_PAGE;
    return {
      paginatedTips: filtered.slice(startIndex, startIndex + TIPS_PER_PAGE),
      totalPages: total,
    };
  }, [
    tips,
    viewMode,
    selectedJsonGameId,
    selectedTeamFilter,
    currentPage,
    selectedPlayerFilter,
    selectedPropFilter,
    minOdds,
    maxOdds,
  ]);

  // --- RENDER ---
  return (
    <div className={styles.dashboardContainer}>
      <DashboardSidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        oddsLeagueId={oddsLeagueId}
        setOddsLeagueId={setOddsLeagueId}
        jsonGames={jsonGames}
        selectedJsonGameId={selectedJsonGameId}
        setSelectedJsonGameId={(id) => {
          setSelectedJsonGameId(id);
          setCurrentPage(1);
        }}
        jsonTeams={jsonTeams}
        selectedTeamFilter={selectedTeamFilter}
        setSelectedTeamFilter={(team) => {
          setSelectedTeamFilter(team);
          setCurrentPage(1);
        }}
        games={games}
        selectedGameId={selectedGameId}
        setSelectedGameId={setSelectedGameId}
        playerSearchQuery={playerSearchQuery}
        handlePlayerSearchChange={handlePlayerSearchChange}
        playerSearchResults={playerSearchResults}
        showPlayerDropdown={showPlayerDropdown}
        setShowPlayerDropdown={setShowPlayerDropdown}
        selectedPlayerFilter={selectedPlayerFilter}
        handleSelectPlayer={handleSelectPlayer}
        clearPlayerFilter={clearPlayerFilter}
        selectedPropFilter={selectedPropFilter}
        setSelectedPropFilter={(prop) => {
          setSelectedPropFilter(prop);
          setCurrentPage(1);
        }}
        minOdds={minOdds}
        maxOdds={maxOdds}
        handleMinOddsChange={handleMinOddsChange}
        handleMaxOddsChange={handleMaxOddsChange}
        resetDashboardFilters={resetDashboardFilters}
        tipsCount={tips.length}
        testDate={testDate}
      />

      <TipsList
        loading={loading}
        paginatedTips={paginatedTips}
        currentPage={currentPage}
        totalPages={totalPages}
        goToPage={goToPage}
        testDate={testDate}
      />
    </div>
  );
}
