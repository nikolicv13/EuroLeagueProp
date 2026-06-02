import type { PlayerSearchResult, CurrentTip } from "../../api/types";
import styles from "./PlayerToolbar.module.css";
import Breadcrumb from "../../components/dashboard/shared/Breadcrumb";
import { useSearchParams } from "react-router-dom";

interface PlayerToolbarProps {
  // Search & Dropdown
  searchQuery: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchResults: PlayerSearchResult[];
  showDropdown: boolean;
  setShowDropdown: (b: boolean) => void;
  handleSelectPlayer: (p: PlayerSearchResult) => void;

  // Inputs
  inputLeague: string;
  showLeagueFilter?: boolean;
  setInputLeague: (v: string) => void;
  inputOverUnder: "over" | "under";
  setInputOverUnder: (v: "over" | "under") => void;
  inputLine: number;
  setInputLine: (v: number) => void;
  inputMarket: string;
  setInputMarket: (v: string) => void;

  // Actions & Data
  handleSearch: () => void;
  tip?: CurrentTip; // Optional now, since Search Page doesn't have a committed tip yet
}

export default function PlayerToolbar(props: PlayerToolbarProps) {
  // Determine layout based on prop
  const showLeague = props.showLeagueFilter ?? false;
  const gridClass = showLeague
    ? styles.toolbarGridWithLeague
    : styles.toolbarGridWithoutLeague;

  const [searchParams] = useSearchParams();

  const currentLeagueId =
    props.inputLeague || searchParams.get("leagueId") || "631799";
  const getLeagueName = (id: string) => {
    if (id === "631799") return "Euroleague";
    if (id === "eurocup") return "Eurocup";
    if (id === "nba") return "NBA";
    return "League";
  };
  return (
    <>
      <Breadcrumb
        leagueId={currentLeagueId}
        leagueName={getLeagueName(currentLeagueId)}
        playerName={props.tip?.player || props.searchQuery || "Unknown Player"}
      />

      <div className={styles.toolbar}>
        <div className={gridClass}>
          {/* ROW 1, COL 1: Player Name */}
          <div
            className={`${styles.formGroup} ${styles.searchGroup} ${showLeague ? styles.wlPlayer : styles.nolPlayer}`}
          >
            <label className={styles.formLabel}>Player Name</label>
            <input
              type="text"
              value={props.searchQuery}
              onChange={props.handleSearchChange}
              onBlur={() => setTimeout(() => props.setShowDropdown(false), 200)}
              onFocus={() =>
                props.searchResults.length > 0 && props.setShowDropdown(true)
              }
              placeholder="Search player..."
              className={styles.formInput}
            />
            {props.showDropdown && props.searchResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {props.searchResults.map((p, i) => (
                  <li
                    key={`${p.player_id}-${i}`}
                    onMouseDown={() => props.handleSelectPlayer(p)}
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

          {/* ROW 1, COL 2: League (ONLY IF showLeague is true) */}
          {showLeague && props.inputLeague && props.setInputLeague && (
            <div className={`${styles.formGroup} ${styles.wlLeague}`}>
              <label className={styles.formLabel}>League</label>
              <select
                value={props.inputLeague}
                onChange={(e) => props.setInputLeague!(e.target.value)}
                className={styles.formSelect}
              >
                <option value="631799">Euroleague</option>
                <option value="eurocup">Eurocup</option>
                <option value="nba">NBA</option>
              </select>
            </div>
          )}

          {/* ROW 1, COL 3 (or 2): Over/Under */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.wlOverUnder : styles.nolOverUnder}`}
          >
            <label className={styles.formLabel}>Over/Under</label>
            <select
              value={props.inputOverUnder}
              onChange={(e) =>
                props.setInputOverUnder(e.target.value as "over" | "under")
              }
              className={styles.formSelect}
            >
              <option value="over">OVER</option>
              <option value="under">UNDER</option>
            </select>
          </div>

          {/* ROW 2, COL 1-2 (or 1): Prop Type */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.wlPropType : styles.nolPropType}`}
          >
            <label className={styles.formLabel}>Prop Type</label>
            <select
              value={props.inputMarket}
              onChange={(e) => props.setInputMarket(e.target.value)}
              className={styles.formSelect}
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
          </div>

          {/* ROW 2, COL 3 (or 2): Line */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.wlLine : styles.nolLine}`}
          >
            <label className={styles.formLabel}>Line</label>
            <input
              type="number"
              step="0.5"
              value={props.inputLine}
              onChange={(e) => props.setInputLine(parseFloat(e.target.value))}
              className={styles.formInput}
            />
          </div>

          {/* ROW 3: Search Button (Spans all columns automatically) */}
          <div className={`${styles.formGroup} ${styles.gridSearchBtn}`}>
            <button onClick={props.handleSearch} className={styles.searchBtn}>
              🔍 Search Matchup
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
