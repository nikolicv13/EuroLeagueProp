import React from "react";
import type { PlayerSearchResult, JsonGame } from "../../api/types";
import OddsSlider from "./OddsSlider";
import styles from "./DashboardSidebar.module.css";

interface DashboardSidebarProps {
  oddsLeagueId: string;
  setOddsLeagueId: (id: string) => void;
  jsonGames: JsonGame[];
  selectedJsonGameId: string;
  setSelectedJsonGameId: (id: string) => void;
  jsonTeams: string[];
  selectedTeamFilter: string;
  setSelectedTeamFilter: (team: string) => void;
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
      <h2 className={styles.sidebarTitle}>Filters</h2>

      <div className={styles.sidebarSection}>
        {/* LEAGUE SELECT */}
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

        {/* GAME FILTER */}
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

        {/* TEAM FILTER */}
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
      </div>

      {/* PLAYER SEARCH */}
      <div className={styles.playerSearchWrapper}>
        <label className={styles.filterLabel}>Filter by Player</label>
        <div className={styles.inputWithClear}>
          <input
            type="text"
            className={`${styles.filterInput} ${props.selectedPlayerFilter ? styles.filterInputActive : ""}`}
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
              className={styles.clearInputBtn}
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
        Reset Filters
      </button>
    </div>
  );
}
