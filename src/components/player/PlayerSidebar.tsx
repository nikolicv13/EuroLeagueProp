import React from "react";
import type { PlayerSearchResult } from "../../api/types";
import styles from "./PlayerSidebar.module.css";

// Define the shape of the selected teammate/opponent objects
interface SelectedPlayer {
  id: string;
  name: string;
}

interface PlayerSidebarProps {
  // Venue & Phase Filters
  venueFilter: "all" | "home" | "away";
  handleVenueChange: (v: "all" | "home" | "away") => void;
  phaseFilter: "all" | "regular" | "playoffs";
  handlePhaseChange: (v: "all" | "regular" | "playoffs") => void;

  // Season & League
  selectedSeason: string;
  setSelectedSeason: (v: string) => void;
  selectedLeagues: string[];
  handleLeagueToggle: (l: string) => void;

  // Opposing Player Filter
  oppPlayerQuery: string;
  handleOppSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  oppPlayerResults: PlayerSearchResult[];
  showOppDropdown: boolean;
  setShowOppDropdown: (b: boolean) => void;
  selectedOppPlayer: SelectedPlayer | null;
  handleSelectOppPlayer: (p: PlayerSearchResult) => void;
  clearOppPlayer: () => void;

  // With Teammate Filter
  withQuery: string;
  handleTeammateSearch: (t: "with" | "without", v: string) => void;
  withResults: PlayerSearchResult[];
  showWithDropdown: boolean;
  setShowWithDropdown: (b: boolean) => void;
  selectedWith: SelectedPlayer | null;
  handleSelectTeammate: (t: "with" | "without", p: PlayerSearchResult) => void;

  // Without Teammate Filter
  withoutQuery: string;
  withoutResults: PlayerSearchResult[];
  showWithoutDropdown: boolean;
  setShowWithoutDropdown: (b: boolean) => void;
  selectedWithout: SelectedPlayer | null;
  clearTeammate: (t: "with" | "without") => void;

  // Reset
  resetPlayerFilters: () => void;
}

export default function PlayerSidebar(props: PlayerSidebarProps) {
  return (
    <div className={styles.filtersColumn}>
      {/* Venue Toggle */}
      <h3 className={styles.filterTitle}>Home/Away</h3>
      <p className={styles.filterParagraph}>Filter stats by home or away</p>
      <div className={styles.venueToggleGroup}>
        <button
          onClick={() => props.handleVenueChange("all")}
          className={
            props.venueFilter === "all"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          Both
        </button>
        <button
          onClick={() => props.handleVenueChange("home")}
          className={
            props.venueFilter === "home"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          Home
        </button>
        <button
          onClick={() => props.handleVenueChange("away")}
          className={
            props.venueFilter === "away"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          Away
        </button>
      </div>

      {/* Phase Toggle */}
      <h3 className={styles.filterTitle} style={{ marginTop: "24px" }}>
        Phase
      </h3>
      <p className={styles.filterParagraph}>
        Filter by Regular Season or Playoffs
      </p>
      <div className={styles.venueToggleGroup}>
        <button
          onClick={() => props.handlePhaseChange("all")}
          className={
            props.phaseFilter === "all"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          All
        </button>
        <button
          onClick={() => props.handlePhaseChange("regular")}
          className={
            props.phaseFilter === "regular"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          Regular
        </button>
        <button
          onClick={() => props.handlePhaseChange("playoffs")}
          className={
            props.phaseFilter === "playoffs"
              ? styles.venueToggleButtonActive
              : styles.venueToggleButton
          }
        >
          Playoffs
        </button>
      </div>

      {/* Season Filter */}
      <div className={styles.filterGroup}>
        <span className={styles.filterGroupLabel}>Season</span>
        <select
          className={styles.seasonDropdown}
          value={props.selectedSeason}
          onChange={(e) => props.setSelectedSeason(e.target.value)}
        >
          <option value="E2025">2025/26</option>
          <option value="E2024">2024/25</option>
          <option value="E2023">2023/24</option>
        </select>
      </div>

      {/* ==========================================
          1. OPPOSING PLAYER FILTER
          ========================================== */}
      <div className={styles.filterGroup} style={{ marginTop: "10px" }}>
        <label className={styles.filterLabel}>Filter by Opposing Player</label>
        <div className={styles.inputWithClear}>
          <input
            type="text"
            value={props.oppPlayerQuery}
            onChange={props.handleOppSearchChange}
            onBlur={() =>
              setTimeout(() => props.setShowOppDropdown(false), 200)
            }
            onFocus={() =>
              props.oppPlayerResults.length > 0 &&
              props.setShowOppDropdown(true)
            }
            placeholder="Search opponent..."
            className={`${styles.filterInput} ${props.selectedOppPlayer ? styles.filterInputActiveOpp : ""}`}
          />
          {props.selectedOppPlayer && (
            <button
              onClick={props.clearOppPlayer}
              className={styles.clearInputBtn}
              title="Clear opponent filter"
            >
              ✕
            </button>
          )}

          {props.showOppDropdown && props.oppPlayerResults.length > 0 && (
            <ul className={styles.searchDropdown}>
              {props.oppPlayerResults.map((p, i) => (
                <li
                  key={`${p.player_id}-${i}`}
                  onMouseDown={() => props.handleSelectOppPlayer(p)}
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
      </div>

      {/* ==========================================
          2. TEAMMATE FILTERS (WITH & WITHOUT)
          ========================================== */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          marginTop: "10px",
        }}
      >
        {/* WITH Teammate */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} style={{ color: "#4caf50" }}>
            With Teammate
          </label>
          <div className={styles.inputWithClear}>
            <input
              type="text"
              value={props.withQuery}
              onChange={(e) =>
                props.handleTeammateSearch("with", e.target.value)
              }
              onBlur={() =>
                setTimeout(() => props.setShowWithDropdown(false), 200)
              }
              onFocus={() =>
                props.withResults.length > 0 && props.setShowWithDropdown(true)
              }
              placeholder="Search teammate..."
              className={`${styles.filterInput} ${props.selectedWith ? styles.filterInputActiveWith : ""}`}
            />
            {props.selectedWith && (
              <button
                onClick={() => props.clearTeammate("with")}
                className={styles.clearInputBtn}
                title="Clear teammate filter"
              >
                ✕
              </button>
            )}

            {props.showWithDropdown && props.withResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {props.withResults.map((p, i) => (
                  <li
                    key={`${p.player_id}-${i}`}
                    onMouseDown={() => props.handleSelectTeammate("with", p)}
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
        </div>

        {/* WITHOUT Teammate */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} style={{ color: "#e94560" }}>
            Without Teammate
          </label>
          <div className={styles.inputWithClear}>
            <input
              type="text"
              value={props.withoutQuery}
              onChange={(e) =>
                props.handleTeammateSearch("without", e.target.value)
              }
              onBlur={() =>
                setTimeout(() => props.setShowWithoutDropdown(false), 200)
              }
              onFocus={() =>
                props.withoutResults.length > 0 &&
                props.setShowWithoutDropdown(true)
              }
              placeholder="Search teammate..."
              className={`${styles.filterInput} ${props.selectedWithout ? styles.filterInputActiveWithout : ""}`}
            />
            {props.selectedWithout && (
              <button
                onClick={() => props.clearTeammate("without")}
                className={styles.clearInputBtn}
                title="Clear teammate filter"
              >
                ✕
              </button>
            )}

            {props.showWithoutDropdown && props.withoutResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {props.withoutResults.map((p, i) => (
                  <li
                    key={`${p.player_id}-${i}`}
                    onMouseDown={() => props.handleSelectTeammate("without", p)}
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
        </div>
      </div>
      {/* League Filter */}
      <div className={styles.filterGroup}>
        <span className={styles.filterGroupLabel}>League</span>
        <label className={styles.checkboxItem}>
          <input
            type="checkbox"
            checked={props.selectedLeagues.includes("euroleague")}
            onChange={() => props.handleLeagueToggle("euroleague")}
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

      {/* Reset Button */}
      <button
        onClick={props.resetPlayerFilters}
        className={styles.resetMatchupBtn}
      >
        RESET
      </button>
    </div>
  );
}
