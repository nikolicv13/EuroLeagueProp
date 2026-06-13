import { useState, useEffect, useMemo } from "react";
import type { Tip, PlayerSearchResult, JsonGame } from "../../api/types";
import { fetchBrazilBetOdds, fetchPlayerSearch } from "../../api/api";
import DashboardSidebar from "./DashboardSidebar";
import TipsList from "./TipsList";
import type { SortType } from "./TipsList";
import styles from "./TipsDashboard.module.css";

export default function TipsDashboard() {
  // --- STATE ---
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [oddsLeagueId, setOddsLeagueId] = useState("631799");
  const [jsonGames, setJsonGames] = useState<JsonGame[]>([]);
  const [jsonTeams, setJsonTeams] = useState<string[]>([]);
  const [selectedJsonGameId, setSelectedJsonGameId] = useState<string>("all");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [activeSort, setActiveSort] = useState<SortType>("confidence");

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
  const testDate = "2026-05-24"; // Kept for TipCard display

  useEffect(() => {
    document.body.style.overflow = mobileFilterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileFilterOpen]);

  // --- HANDLERS ---
  const handlePlayerSearchChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setPlayerSearchQuery(value);
    if (value.length >= 2) {
      try {
        const results = await fetchPlayerSearch(value);
        setPlayerSearchResults(results);
        setShowPlayerDropdown(true);
      } catch (err) {
        console.error(err);
      }
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
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setTips([]);
      setCurrentPage(1);
      try {
        const data = await fetchBrazilBetOdds(oddsLeagueId);
        setTips(data);

        const uniqueGamesMap = new Map<string, JsonGame>();
        const uniqueTeamsSet = new Set<string>();

        data.forEach((tip: Tip) => {
          const tAbbr = tip.team_abbr || tip.team_id || tip.team || "UNK";
          const oAbbr =
            tip.opponent_abbr || tip.opponent_team_id || tip.opponent || "UNK";
          if (!uniqueGamesMap.has(tip.game_id))
            uniqueGamesMap.set(tip.game_id, {
              game_id: tip.game_id,
              team: tAbbr,
              opponent: oAbbr,
            });
          uniqueTeamsSet.add(tAbbr);
        });

        setJsonGames(Array.from(uniqueGamesMap.values()));
        setJsonTeams(Array.from(uniqueTeamsSet).sort());
        setSelectedJsonGameId("all");
        setSelectedTeamFilter("all");
      } catch (err) {
        console.error("Failed to load odds:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [oddsLeagueId]);

  // --- MEMOIZED DATA ---
  const getMarketGroup = (market: string) => {
    if (market.startsWith("points")) return "points";
    if (market.startsWith("rebounds")) return "rebounds";
    if (market.startsWith("assists")) return "assists";
    return market;
  };

  const { paginatedTips, totalPages } = useMemo(() => {
    let filtered = tips;

    // 1. Filtering
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

    // 2. Sorting
    const sorted = [...filtered];
    switch (activeSort) {
      case "confidence":
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case "last5":
        sorted.sort(
          (a, b) =>
            (b.hit_rates?.last5?.rate || 0) - (a.hit_rates?.last5?.rate || 0),
        );
        break;
      case "last10":
        sorted.sort(
          (a, b) =>
            (b.hit_rates?.last10?.rate || 0) - (a.hit_rates?.last10?.rate || 0),
        );
        break;
      case "last15":
        sorted.sort(
          (a, b) =>
            (b.hit_rates?.last15?.rate || 0) - (a.hit_rates?.last15?.rate || 0),
        );
        break;
      case "vsOpp":
        sorted.sort(
          (a, b) =>
            (b.hit_rates?.vs_opp?.rate || 0) - (a.hit_rates?.vs_opp?.rate || 0),
        );
        break;
      case "trending":
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }

    // 3. Pagination
    const total = Math.ceil(sorted.length / TIPS_PER_PAGE);
    const startIndex = (currentPage - 1) * TIPS_PER_PAGE;
    return {
      paginatedTips: sorted.slice(startIndex, startIndex + TIPS_PER_PAGE),
      totalPages: total,
    };
  }, [
    tips,
    selectedJsonGameId,
    selectedTeamFilter,
    currentPage,
    selectedPlayerFilter,
    selectedPropFilter,
    minOdds,
    maxOdds,
    activeSort,
  ]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedJsonGameId !== "all") count++;
    if (selectedTeamFilter !== "all") count++;
    if (selectedPlayerFilter) count++;
    if (selectedPropFilter !== "all") count++;
    if (minOdds > 1.0 || maxOdds < 10.0) count++;
    return count;
  }, [
    selectedJsonGameId,
    selectedTeamFilter,
    selectedPlayerFilter,
    selectedPropFilter,
    minOdds,
    maxOdds,
  ]);

  // --- RENDER ---
  const sortOptions: { value: SortType; label: string }[] = [
    { value: "trending", label: " Trending" },
    { value: "confidence", label: " Confidence" },
    { value: "last5", label: "Last 5" },
    { value: "last10", label: "Last 10" },
    { value: "last15", label: "Last 15" },
    { value: "vsOpp", label: "vs Opponent" },
  ];

  return (
    <div className={styles.dashboardWrapper}>
      {/* 👈 MOBILE FILTER OVERLAY */}
      {mobileFilterOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileFilterOpen(false)}
        />
      )}

      {/* 👈 MOBILE FILTER DRAWER */}
      <div
        className={`${styles.mobileDrawer} ${mobileFilterOpen ? styles.mobileDrawerOpen : ""}`}
      >
        <div className={styles.mobileDrawerHeader}>
          <span className={styles.mobileDrawerTitle}>Filters</span>
          <button
            className={styles.mobileDrawerClose}
            onClick={() => setMobileFilterOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className={styles.mobileDrawerBody}>
          <DashboardSidebar
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
          />
        </div>
      </div>

      {/* GLOBAL SORT BAR */}
      <div className={styles.sortBarContainer}>
        <div className={styles.sortToggleGroup}>
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setActiveSort(opt.value);
                setCurrentPage(1);
              }}
              className={
                activeSort === opt.value
                  ? styles.sortButtonActive
                  : styles.sortButton
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className={styles.dashboardContainer}>
        {/* 👈 DESKTOP SIDEBAR (hidden on mobile via CSS) */}
        <div className={styles.desktopSidebar}>
          <DashboardSidebar
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
          />
        </div>

        <TipsList
          loading={loading}
          paginatedTips={paginatedTips}
          currentPage={currentPage}
          totalPages={totalPages}
          goToPage={goToPage}
          testDate={testDate}
        />
      </div>

      {/* 👈 FLOATING FILTER BUTTON (mobile only) */}
      <button
        className={styles.mobileFilterFab}
        onClick={() => setMobileFilterOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="12" y1="18" x2="20" y2="18" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className={styles.fabBadge}>{activeFilterCount}</span>
        )}
      </button>
    </div>
  );
}
