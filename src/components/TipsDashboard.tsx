import { useState, useEffect, useMemo } from "react";
import type { Game, Tip, PlayerSearchResult } from "../api/api";
import {
  fetchGames,
  fetchTips,
  fetchBrazilBetOdds,
  fetchPlayerSearch,
} from "../api/api";
import TipCard from "./TipCard";
import styles from "./TipsDashboard.module.css";

interface JsonGame {
  game_id: string;
  team: string;
  opponent: string;
}

export default function TipsDashboard() {
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

  const TIPS_PER_PAGE = 10;
  const testDate = "2026-05-24";

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
    setCurrentPage(1); // Reset pagination
  };

  const clearPlayerFilter = () => {
    setSelectedPlayerFilter(null);
    setPlayerSearchQuery("");
    setCurrentPage(1); // Reset pagination
  };

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

            if (!uniqueGamesMap.has(tip.game_id)) {
              uniqueGamesMap.set(tip.game_id, {
                game_id: tip.game_id,
                team: tAbbr,
                opponent: oAbbr,
              });
            }
            uniqueTeamsSet.add(tAbbr);
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

  const { paginatedTips, totalPages } = useMemo(() => {
    let filtered = tips;

    if (viewMode === "odds") {
      if (selectedJsonGameId !== "all") {
        filtered = filtered.filter((t) => t.game_id === selectedJsonGameId);
      }
      if (selectedTeamFilter !== "all") {
        filtered = filtered.filter(
          (t) => (t.team_abbr || t.team_id) === selectedTeamFilter,
        );
      }

      if (selectedPlayerFilter) {
        filtered = filtered.filter(
          (t) => t.player_id === selectedPlayerFilter.player_id,
        );
      }
    }

    const total = Math.ceil(filtered.length / TIPS_PER_PAGE);
    const startIndex = (currentPage - 1) * TIPS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + TIPS_PER_PAGE);

    return { paginatedTips: paginated, totalPages: total };
  }, [
    tips,
    viewMode,
    selectedJsonGameId,
    selectedTeamFilter,
    currentPage,
    selectedPlayerFilter,
  ]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getLeagueLogo = (id: string) => {
    if (id === "631799") return "euroleague";
    if (id === "eurocup") return "eurocup";
    if (id === "nba") return "nba";
    return "placeholder"; // Fallback if needed
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* LEFT SIDEBAR */}
      <div className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Data Source</h2>

        {/* MODE TOGGLE */}
        <div className={styles.modeToggleContainer}>
          <button
            onClick={() => setViewMode("odds")}
            className={`${styles.modeButton} ${viewMode === "odds" ? styles.modeButtonActiveOdds : ""}`}
          >
            🎯 Live Odds
          </button>
          <button
            onClick={() => setViewMode("db")}
            className={`${styles.modeButton} ${viewMode === "db" ? styles.modeButtonActiveDb : ""}`}
          >
            🗄️ DB Tips
          </button>
        </div>

        {/* CONDITIONAL SIDEBAR CONTENT */}
        {viewMode === "odds" ? (
          <div className={styles.sidebarSection}>
            <div>
              <label className={styles.filterLabel}>Select League</label>
              <div className={styles.leagueSelectWrapper}>
                <img
                  src={`/public/logos/${getLeagueLogo(oddsLeagueId)}.png`}
                  alt="League Logo"
                  className={styles.leagueSelectIcon}
                  onError={(e) => {
                    // Fallback if image is missing
                    (e.currentTarget as HTMLImageElement).src =
                      "/logos/placeholder.png";
                  }}
                />

                <select
                  className={`${styles.filterSelect} ${styles.leagueSelect}`}
                  value={oddsLeagueId}
                  onChange={(e) => setOddsLeagueId(e.target.value)}
                >
                  <option value="631799">Euroleague</option>
                  <option value="eurocup" disabled>
                    Eurocup (Coming Soon)
                  </option>
                  <option value="nba" disabled>
                    NBA (Coming Soon)
                  </option>
                </select>
              </div>
            </div>

            {jsonGames.length > 0 && (
              <div>
                <label className={styles.filterLabel}>Filter by Game</label>
                <select
                  className={styles.filterSelect}
                  value={selectedJsonGameId}
                  onChange={(e) => {
                    setSelectedJsonGameId(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">All Games ({tips.length} props)</option>
                  {jsonGames.map((g) => (
                    <option key={g.game_id} value={g.game_id}>
                      {g.team} vs {g.opponent}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {jsonTeams.length > 0 && (
              <div>
                <label className={styles.filterLabel}>Filter by Team</label>
                <select
                  className={styles.filterSelect}
                  value={selectedTeamFilter}
                  onChange={(e) => {
                    setSelectedTeamFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">All Teams</option>
                  {jsonTeams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className={styles.statusSuccess}>
              ✅ Currently showing mock/live odds data.
            </p>
          </div>
        ) : (
          <div className={styles.sidebarSection}>
            <label className={styles.filterLabel}>
              Select Game ({testDate})
            </label>
            {games.length === 0 ? (
              <p className={styles.statusError}>⚠️ No games found in DB.</p>
            ) : (
              <select
                className={styles.filterSelect}
                value={selectedGameId || ""}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                {games.map((game) => (
                  <option key={game.game_id} value={game.game_id}>
                    {game.team_a} vs {game.team_b}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {/* NEW: FILTER BY PLAYER */}
        <div className={styles.playerSearchWrapper}>
          <label className={styles.filterLabel}>Filter by Player</label>
          <div className={styles.playerSearchRow}>
            <input
              type="text"
              className={styles.filterInput}
              style={{ flex: 1 }}
              placeholder="Search player..."
              value={playerSearchQuery}
              onChange={handlePlayerSearchChange}
              onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 200)}
              onFocus={() =>
                playerSearchResults.length > 0 && setShowPlayerDropdown(true)
              }
            />
            {selectedPlayerFilter && (
              <button
                onClick={clearPlayerFilter}
                className={styles.clearPlayerBtn}
                title="Clear player filter"
              >
                ✕
              </button>
            )}
          </div>

          {showPlayerDropdown && playerSearchResults.length > 0 && (
            <ul className={styles.playerDropdown}>
              {playerSearchResults.map((p, index) => (
                <li
                  key={`${p.player_id}-${index}`}
                  className={styles.playerDropdownItem}
                  onMouseDown={() => handleSelectPlayer(p)} // Use onMouseDown to beat the onBlur timeout
                >
                  <span className={styles.playerDropdownName}>
                    {p.player_name}
                  </span>
                  <span className={styles.playerDropdownInfo}>
                    {p.team_id} | {p.position}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {selectedPlayerFilter && (
            <p className={styles.statusSuccess} style={{ marginTop: "8px" }}>
              🎯 Showing props for {selectedPlayerFilter.player_name}
            </p>
          )}
        </div>
      </div>

      {/* RIGHT MAIN AREA */}
      <div className={styles.mainContent}>
        {loading && <p className={styles.loadingText}>Loading tips...</p>}

        {!loading && paginatedTips.length === 0 && (
          <p className={styles.emptyText}>No tips found for this selection.</p>
        )}

        <div className={styles.tipsList}>
          {paginatedTips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              dateLabel={testDate}
              onGameReport={(t) => console.log("Game report for:", t.player)}
            />
          ))}
        </div>

        {/* PAGINATION CONTROLS */}
        {!loading && totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`${styles.paginationBtn} ${currentPage === 1 ? styles.paginationBtnDisabled : ""}`}
            >
              ← Previous
            </button>

            <span className={styles.paginationInfo}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`${styles.paginationBtn} ${currentPage === totalPages ? styles.paginationBtnDisabled : ""}`}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
