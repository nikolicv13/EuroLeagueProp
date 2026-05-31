import React from "react";
import type { Game, PlayerSearchResult, JsonGame } from "../../api/types";
import OddsSlider from "./OddsSlider";
import styles from "./DashboardSidebar.module.css";

interface DashboardSidebarProps {
  viewMode: "odds" | "db";
  setViewMode: (mode: "odds" | "db") => void;
  oddsLeagueId: string;
  setOddsLeagueId: (id: string) => void;
  jsonGames: JsonGame[];
  selectedJsonGameId: string;
  setSelectedJsonGameId: (id: string) => void;
  jsonTeams: string[];
  selectedTeamFilter: string;
  setSelectedTeamFilter: (team: string) => void;
  games: Game[];
  selectedGameId: string | null;
  setSelectedGameId: (id: string) => void;
  playerSearchQuery: string;
  handlePlayerSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playerSearchResults: PlayerSearchResult[];
  showPlayerDropdown: boolean;
  setShowPlayerDropdown: (show: boolean) => void;
  selectedPlayerFilter: PlayerSearchResult | null;
  handleSelectPlayer: (player: PlayerSearchResult) => void;
  clearPlayerFilter: () => void;
  selectedPropFilter: string;
  setSelectedPropFilter: (prop: string) => void;
  minOdds: number;
  maxOdds: number;
  handleMinOddsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMaxOddsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetDashboardFilters: () => void;
  tipsCount: number;
  testDate: string;
}

export default function DashboardSidebar(props: DashboardSidebarProps) {
  const getLeagueLogo = (id: string) => {
    if (id === "631799") return "euroleague";
    if (id === "eurocup") return "eurocup";
    if (id === "nba") return "nba";
    return "placeholder";
  };

  return (
    <div className={styles.sidebar}>
      <h2 className={styles.sidebarTitle}>Data Source</h2>

      {/* MODE TOGGLE */}
      <div className={styles.modeToggleContainer}>
        <button
          onClick={() => props.setViewMode("odds")}
          className={`${styles.modeButton} ${props.viewMode === "odds" ? styles.modeButtonActiveOdds : ""}`}
        >
          🎯 Live Odds
        </button>
        <button
          onClick={() => props.setViewMode("db")}
          className={`${styles.modeButton} ${props.viewMode === "db" ? styles.modeButtonActiveDb : ""}`}
        >
          🗄️ DB Tips
        </button>
      </div>

      {/* CONDITIONAL SIDEBAR CONTENT */}
      {props.viewMode === "odds" ? (
        <div className={styles.sidebarSection}>
          <div>
            <label className={styles.filterLabel}>Select League</label>
            <div className={styles.leagueSelectWrapper}>
              <img
                src={`/logos/${getLeagueLogo(props.oddsLeagueId)}.png`}
                alt="League Logo"
                className={styles.leagueSelectIcon}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/logos/placeholder.png";
                }}
              />
              <select
                className={`${styles.filterSelect} ${styles.leagueSelect}`}
                value={props.oddsLeagueId}
                onChange={(e) => props.setOddsLeagueId(e.target.value)}
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

          {props.jsonGames.length > 0 && (
            <div>
              <label className={styles.filterLabel}>Filter by Game</label>
              <select
                className={styles.filterSelect}
                value={props.selectedJsonGameId}
                onChange={(e) => {
                  props.setSelectedJsonGameId(e.target.value);
                }}
              >
                <option value="all">All Games ({props.tipsCount} props)</option>
                {props.jsonGames.map((g) => (
                  <option key={g.game_id} value={g.game_id}>
                    {g.team} vs {g.opponent}
                  </option>
                ))}
              </select>
            </div>
          )}

          {props.jsonTeams.length > 0 && (
            <div>
              <label className={styles.filterLabel}>Filter by Team</label>
              <select
                className={styles.filterSelect}
                value={props.selectedTeamFilter}
                onChange={(e) => {
                  props.setSelectedTeamFilter(e.target.value);
                }}
              >
                <option value="all">All Teams</option>
                {props.jsonTeams.map((t) => (
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
            Select Game ({props.testDate})
          </label>
          {props.games.length === 0 ? (
            <p className={styles.statusError}>⚠️ No games found in DB.</p>
          ) : (
            <select
              className={styles.filterSelect}
              value={props.selectedGameId || ""}
              onChange={(e) => props.setSelectedGameId(e.target.value)}
            >
              {props.games.map((game) => (
                <option key={game.game_id} value={game.game_id}>
                  {game.team_a} vs {game.team_b}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* PLAYER SEARCH */}
      <div className={styles.playerSearchWrapper}>
        <label className={styles.filterLabel}>Filter by Player</label>
        <div className={styles.playerSearchRow}>
          <input
            type="text"
            className={styles.filterInput}
            style={{ flex: 1 }}
            placeholder="Search player..."
            value={props.playerSearchQuery}
            onChange={props.handlePlayerSearchChange}
            onBlur={() =>
              setTimeout(() => props.setShowPlayerDropdown(false), 200)
            }
            onFocus={() =>
              props.playerSearchResults.length > 0 &&
              props.setShowPlayerDropdown(true)
            }
          />
          {props.selectedPlayerFilter && (
            <button
              onClick={props.clearPlayerFilter}
              className={styles.clearPlayerBtn}
              title="Clear player filter"
            >
              ✕
            </button>
          )}
        </div>

        {props.showPlayerDropdown && props.playerSearchResults.length > 0 && (
          <ul className={styles.playerDropdown}>
            {props.playerSearchResults.map((p, index) => (
              <li
                key={`${p.player_id}-${index}`}
                className={styles.playerDropdownItem}
                onMouseDown={() => props.handleSelectPlayer(p)}
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
        {props.selectedPlayerFilter && (
          <p className={styles.statusSuccess} style={{ marginTop: "8px" }}>
            🎯 Showing props for {props.selectedPlayerFilter.player_name}
          </p>
        )}
      </div>

      {/* PROP TYPE */}
      <div>
        <label className={styles.filterLabel}>Filter by Prop Type</label>
        <select
          className={styles.filterSelect}
          value={props.selectedPropFilter}
          onChange={(e) => {
            props.setSelectedPropFilter(e.target.value);
          }}
        >
          <option value="all">All Props</option>
          <option value="points">Points</option>
          <option value="rebounds">Rebounds</option>
          <option value="assists">Assists</option>
          <option value="threes_made">3PT Made</option>
          <option value="pra">P + R + A</option>
          <option value="pa">P + A</option>
          <option value="pr">P + R</option>
          <option value="ra">R + A</option>
          <option value="steals">Steals</option>
          <option value="blocks">Blocks</option>
        </select>
      </div>

      {/* ODDS SLIDER */}
      <OddsSlider
        minOdds={props.minOdds}
        maxOdds={props.maxOdds}
        onMinChange={props.handleMinOddsChange}
        onMaxChange={props.handleMaxOddsChange}
      />

      {/* RESET */}
      <button
        onClick={props.resetDashboardFilters}
        className={styles.resetFiltersBtn}
      >
        ↺ Reset All Filters
      </button>
    </div>
  );
}
